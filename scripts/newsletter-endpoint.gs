/**
 * Inlet Wire — Newsletter Signup Endpoint
 * ----------------------------------------
 * Deploy this as a Google Apps Script Web App.
 *
 * Setup steps (takes ~3 minutes):
 *   1. Go to https://script.google.com and click "New project"
 *   2. Delete the default code and paste ALL of this file
 *   3. Click "Save" (floppy disk icon), give the project a name e.g. "Inlet Wire Subscribers"
 *   4. Click "Deploy" → "New deployment"
 *   5. Under "Select type" choose "Web app"
 *   6. Set "Execute as" → Me
 *   7. Set "Who has access" → Anyone
 *   8. Click "Deploy" and copy the Web app URL
 *   9. Open Footer.astro and paste that URL as the value of data-endpoint on the form
 *  10. In the script editor, open Extensions → Apps Script → find the spreadsheet ID
 *      (or just check the Google Sheet that gets auto-created — share it as View Only)
 *
 * That's it. Every newsletter signup will appear in the Google Sheet
 * and your local sync script will pull it into subscribers.xlsx.
 */

// ── Config ────────────────────────────────────────────────────────────────────
var SHEET_NAME = "Subscribers";

// ── Run this ONCE manually from the editor to authorize Drive access ──────────
function setup() {
  var sheet = getOrCreateSheet();
  Logger.log("✓ Spreadsheet ready: " + sheet.getParent().getUrl());
}

// ── Web app entry points ──────────────────────────────────────────────────────
function doPost(e) {
  try {
    var email = "";

    // Accept both form-encoded and JSON bodies
    if (e.parameter && e.parameter.email) {
      email = e.parameter.email.trim().toLowerCase();
    } else if (e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        email = (body.email || "").trim().toLowerCase();
      } catch (_) {
        // Not JSON — ignore
      }
    }

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ success: false, error: "Invalid email" });
    }

    var sheet = getOrCreateSheet();

    // Deduplicate: scan column A for this email
    var existing = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i][0] === email) {
        return jsonResponse({ success: true, duplicate: true });
      }
    }

    // Append new row
    sheet.appendRow([
      email,
      new Date().toISOString(),
      "website"
    ]);

    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// Returns all subscribers as JSON — used by the local sync script
// Also works as a health check: visit the URL in a browser to confirm it's live
function doGet(e) {
  // If ?action=export is passed, return subscriber data as JSON
  if (e.parameter && e.parameter.action === "export") {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonResponse({ subscribers: [] });
    }

    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    var subscribers = data
      .filter(function(row) { return row[0]; })
      .map(function(row) {
        return {
          email:      row[0],
          date_added: row[1] ? new Date(row[1]).toISOString().slice(0, 10) : "",
          source:     row[2] || "website"
        };
      });

    return jsonResponse({ subscribers: subscribers });
  }

  return ContentService.createTextOutput("Inlet Wire subscriber endpoint is live.");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getOrCreateSheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId  = props.getProperty("SPREADSHEET_ID");
  var ss;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (_) {
      ssId = null; // Spreadsheet was deleted — make a new one
    }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create("Inlet Wire Subscribers");
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["email", "date_added", "source"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    // Remove the default blank Sheet1 if it exists
    var defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  }

  return sheet;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
