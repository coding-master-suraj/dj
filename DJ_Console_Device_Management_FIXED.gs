/*************************************************
 * DJ AUDIO CONSOLE
 * DEVICE MANAGEMENT + APPROVAL + BLOCK SYSTEM
 * + EQ PRESET SYSTEM + MULTI-DEVICE MAP VIEW
 *************************************************/


/* =================================================
   SETTINGS
================================================= */

var APP_PASSWORD = "12345";

var ADMIN_EMAIL =
  "surajmondalpapu6@gmail.com";

var DB_NAME =
  "DJ_Console_Device_DB";

/*
  LastSeen গত 30 seconds-এর মধ্যে হলে
  device LIVE হিসেবে দেখাবে।
*/
var LIVE_TIMEOUT_SECONDS = 30;


/* =================================================
   MAIN POST
================================================= */

function doPost(e) {

  try {

    var data = {};

    if (
      e &&
      e.postData &&
      e.postData.contents
    ) {

      data =
        JSON.parse(
          e.postData.contents || "{}"
        );

    }

    var action =
      data.action || "";


    /* =================================================
       DEVICE POWER ON / LOGIN REQUEST
    ================================================= */

    if (
      action ===
      "request_power_on"
    ) {

      var deviceId =
        String(
          data.deviceId || ""
        ).trim();

      var deviceName =
        data.deviceName ||
        "Unknown Device";

      var locationInfo =
        data.location ||
        "Location Permission Not Granted";

      var latitude =
        data.latitude || "";

      var longitude =
        data.longitude || "";

      var accuracy =
        data.accuracy || "";


      if (!deviceId) {

        return jsonResponse({
          status: "error",
          message: "Device ID missing"
        });

      }


      var existingStatus =
        getDeviceStatus(
          deviceId
        );


      /*
       * Already approved
       */

      if (
        existingStatus ===
          "APPROVED"
        ||
        existingStatus ===
          "LIVE"
      ) {

        updateDeviceRecord(
          deviceId,
          deviceName,
          "APPROVED",
          locationInfo,
          latitude,
          longitude,
          accuracy
        );


        return jsonResponse({
          status: "APPROVED",
          message:
            "Device already approved."
        });

      }


      /*
       * Blocked device
       */

      if (
        existingStatus ===
        "BLOCKED"
      ) {

        sendUnblockRequestEmail(
          deviceId,
          deviceName,
          locationInfo,
          latitude,
          longitude
        );


        return jsonResponse({
          status:
            "blocked_request_sent",

          message:
            "Device is blocked. Unblock request sent to admin."
        });

      }


      /*
       * New / pending device
       */

      updateDeviceRecord(
        deviceId,
        deviceName,
        "PENDING",
        locationInfo,
        latitude,
        longitude,
        accuracy
      );


      sendApprovalEmail(
        deviceId,
        deviceName,
        locationInfo,
        latitude,
        longitude
      );


      return jsonResponse({
        status: "pending",
        message:
          "Approval request sent to admin email."
      });

    }


    /* =================================================
       DEVICE HEARTBEAT
    ================================================= */

    if (
      action ===
      "heartbeat"
    ) {

      var heartbeatDeviceId =
        String(
          data.deviceId || ""
        ).trim();


      if (!heartbeatDeviceId) {

        return jsonResponse({
          status: "error",
          message: "Device ID missing"
        });

      }


      var heartbeatSheet =
        getDatabaseSheet();


      /*
       * IMPORTANT:
       * Blocked device heartbeat
       * will NOT change its status.
       */

      if (
        checkIfBlocked(
          heartbeatSheet,
          heartbeatDeviceId
        )
      ) {

        return jsonResponse({
          status: "BLOCKED",
          message:
            "This device has been blocked."
        });

      }


      updateDeviceHeartbeat(
        heartbeatDeviceId,
        data.deviceName ||
          "Unknown Device",
        data.location || "",
        data.latitude || "",
        data.longitude || "",
        data.accuracy || ""
      );


      return jsonResponse({
        status: "LIVE"
      });

    }


    /* =================================================
       PASSWORD CHECK
    ================================================= */

    if (
      data.password !==
      APP_PASSWORD
    ) {

      return jsonResponse({
        status:
          "invalid_password",

        message:
          "ভুল পাসওয়ার্ড!"
      });

    }


    /* =================================================
       PRESET SYSTEM
    ================================================= */

    var folderName =
      "EQ_Presets_Folder";


    var folders =
      DriveApp.getFoldersByName(
        folderName
      );


    var folder;


    if (
      folders.hasNext()
    ) {

      folder =
        folders.next();

    } else {

      folder =
        DriveApp.createFolder(
          folderName
        );

    }


    var cleanName =
      String(
        data.presetName || ""
      )
      .trim()
      .replace(
        /[^a-zA-Z0-9_\- ]/g,
        ""
      );


    if (!cleanName) {

      return jsonResponse({
        status: "error",
        message:
          "Preset name missing."
      });

    }


    var fileName =
      cleanName + ".json";


    var files =
      folder.getFilesByName(
        fileName
      );


    var payload =
      JSON.stringify({
        presetName:
          data.presetName,

        values:
          data.values
      });


    if (
      files.hasNext()
    ) {

      var file =
        files.next();

      file.setContent(
        payload
      );

    } else {

      folder.createFile(
        fileName,
        payload
      );

    }


    return jsonResponse({
      status: "success",
      message: "Saved"
    });


  } catch (err) {

    Logger.log(
      "doPost ERROR: " +
      err.toString()
    );


    return jsonResponse({
      status: "error",
      message:
        err.toString()
    });

  }

}


/* =================================================
   MAIN GET
================================================= */

function doGet(e) {

  try {

    var action =
      e &&
      e.parameter
        ? e.parameter.action
        : "";


    /* =================================================
       ADMIN APPROVE
    ================================================= */

    if (
      action ===
      "approve"
    ) {

      var approveDeviceId =
        String(
          e.parameter.deviceId ||
          ""
        ).trim();


      if (!approveDeviceId) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "❌ Approval Failed",
              "Device ID পাওয়া যায়নি।"
            )
          );

      }


      var approveResult =
        updateDeviceStatus(
          approveDeviceId,
          "APPROVED"
        );


      if (approveResult) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "✅ Device Approved",
              "The device has been approved successfully."
            )
          );

      }


      return HtmlService
        .createHtmlOutput(
          adminResultPage(
            "❌ Approval Failed",
            "Device পাওয়া যায়নি।"
          )
        );

    }


    /* =================================================
       ADMIN BLOCK
    ================================================= */

    if (
      action ===
      "block"
    ) {

      var blockDeviceId =
        String(
          e.parameter.deviceId ||
          ""
        ).trim();


      if (!blockDeviceId) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "❌ Block Failed",
              "Device ID পাওয়া যায়নি।"
            )
          );

      }


      var blockResult =
        updateDeviceStatus(
          blockDeviceId,
          "BLOCKED"
        );


      if (blockResult) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "❌ Device Blocked",
              "The device has been blocked successfully."
            )
          );

      }


      return HtmlService
        .createHtmlOutput(
          adminResultPage(
            "❌ Block Failed",
            "Device পাওয়া যায়নি।"
          )
        );

    }


    /* =================================================
       ADMIN UNBLOCK
    ================================================= */

    if (
      action ===
      "unblock"
    ) {

      var unblockDeviceId =
        String(
          e.parameter.deviceId ||
          ""
        ).trim();


      if (!unblockDeviceId) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "❌ Unblock Failed",
              "Device ID পাওয়া যায়নি।"
            )
          );

      }


      var unblockResult =
        updateDeviceStatus(
          unblockDeviceId,
          "APPROVED"
        );


      if (unblockResult) {

        return HtmlService
          .createHtmlOutput(
            adminResultPage(
              "🔓 Device Unblocked",
              "The device has been unblocked successfully."
            )
          );

      }


      return HtmlService
        .createHtmlOutput(
          adminResultPage(
            "❌ Unblock Failed",
            "Device পাওয়া যায়নি।"
          )
        );

    }


    /* =================================================
       CHECK DEVICE STATUS
    ================================================= */

    if (
      action ===
      "check_status"
    ) {

      var checkDeviceId =
        String(
          e.parameter.deviceId ||
          ""
        ).trim();


      if (!checkDeviceId) {

        return jsonResponse({
          status: "error",
          message:
            "Device ID missing"
        });

      }


      var currentStatus =
        getDeviceStatus(
          checkDeviceId
        );


      return jsonResponse({
        status:
          currentStatus
      });

    }


    /* =================================================
       ADMIN DEVICE DASHBOARD
    ================================================= */

    if (
      action ===
      "devices"
    ) {

      return createDeviceDashboard();

    }


    /* =================================================
       ALL DEVICES MAP VIEW
    ================================================= */

    if (
      action ===
      "map"
    ) {

      return createAllDevicesMapPage();

    }


    /* =================================================
       PASSWORD VERIFY
    ================================================= */

    var inputPass =
      e &&
      e.parameter
        ? e.parameter.password
        : "";


    if (
      inputPass !==
      APP_PASSWORD
    ) {

      return jsonResponse({
        status:
          "invalid_password",

        message:
          "ভুল পাসওয়ার্ড!"
      });

    }


    if (
      action ===
      "verify"
    ) {

      return jsonResponse({
        status: "success",
        message:
          "Password Correct"
      });

    }


    /* =================================================
       PRESET SYSTEM
    ================================================= */

    var presetFolderName =
      "EQ_Presets_Folder";


    var presetFolders =
      DriveApp.getFoldersByName(
        presetFolderName
      );


    if (
      !presetFolders.hasNext()
    ) {

      return jsonResponse({
        status: "success",
        presets: []
      });

    }


    var presetFolder =
      presetFolders.next();


    /* =================================================
       LIST PRESETS
    ================================================= */

    if (
      action ===
      "list"
    ) {

      var presetFiles =
        presetFolder.getFiles();


      var presetList = [];


      while (
        presetFiles.hasNext()
      ) {

        var presetFile =
          presetFiles.next();


        var presetFileName =
          presetFile.getName();


        if (
          presetFileName
            .toLowerCase()
            .endsWith(".json")
        ) {

          try {

            var presetContent =
              JSON.parse(
                presetFile
                  .getAs(
                    "application/json"
                  )
                  .getDataAsString()
              );


            presetList.push({

              filename:
                presetFileName,

              presetName:
                presetContent
                  .presetName ||
                presetFileName
                  .replace(
                    ".json",
                    ""
                  )

            });

          } catch (parseError) {

            Logger.log(
              "Preset parse error: " +
              parseError
            );

          }

        }

      }


      return jsonResponse({
        status: "success",
        presets:
          presetList
      });

    }


    /* =================================================
       GET PRESET
    ================================================= */

    if (
      action ===
      "get"
    ) {

      var getFileName =
        e.parameter.fileName;


      var getFiles =
        presetFolder
          .getFilesByName(
            getFileName
          );


      if (
        getFiles.hasNext()
      ) {

        var getFile =
          getFiles.next();


        var getContent =
          JSON.parse(
            getFile
              .getAs(
                "application/json"
              )
              .getDataAsString()
          );


        return jsonResponse({
          status: "success",

          values:
            getContent.values
        });

      }


      return jsonResponse({
        status: "not_found",
        message:
          "Preset not found."
      });

    }


    return jsonResponse({
      status: "not_found"
    });


  } catch (err) {

    Logger.log(
      "doGet ERROR: " +
      err.toString()
    );


    return jsonResponse({
      status: "error",
      message:
        err.toString()
    });

  }

}


/* =================================================
   JSON RESPONSE
================================================= */

function jsonResponse(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* =================================================
   DATABASE SHEET
================================================= */

function getDatabaseSheet() {

  var files =
    DriveApp.getFilesByName(
      DB_NAME
    );


  var ss;


  if (
    files.hasNext()
  ) {

    ss =
      SpreadsheetApp.open(
        files.next()
      );

  } else {

    ss =
      SpreadsheetApp.create(
        DB_NAME
      );

  }


  var sheet =
    ss.getSheets()[0];


  var headers = [
    "DeviceID",
    "DeviceName",
    "Status",
    "Location",
    "Latitude",
    "Longitude",
    "Accuracy",
    "LastSeen",
    "CreatedAt"
  ];


  if (
    sheet.getLastRow() === 0
    ||
    sheet.getLastColumn() < 9
  ) {

    sheet
      .getRange(
        1,
        1,
        1,
        9
      )
      .setValues([
        headers
      ]);

  }


  return sheet;

}


/* =================================================
   CHECK IF DEVICE IS BLOCKED
================================================= */

function checkIfBlocked(
  sheet,
  deviceId
) {

  if (!sheet) {
    return false;
  }


  deviceId =
    String(
      deviceId || ""
    ).trim();


  if (!deviceId) {
    return false;
  }


  var data =
    sheet
      .getDataRange()
      .getValues();


  for (
    var i = 1;
    i < data.length;
    i++
  ) {

    var rowDeviceId =
      String(
        data[i][0] || ""
      ).trim();


    if (
      rowDeviceId ===
      deviceId
    ) {

      var status =
        String(
          data[i][2] || ""
        ).trim();


      if (
        status ===
        "BLOCKED"
      ) {

        return true;

      }

      return false;

    }

  }


  return false;

}


/* =================================================
   GET DEVICE STATUS
================================================= */

function getDeviceStatus(
  deviceId
) {

  deviceId =
    String(
      deviceId || ""
    ).trim();


  if (!deviceId) {
    return "PENDING";
  }


  var sheet =
    getDatabaseSheet();


  var data =
    sheet
      .getDataRange()
      .getValues();


  for (
    var i = 1;
    i < data.length;
    i++
  ) {

    var rowDeviceId =
      String(
        data[i][0] || ""
      ).trim();


    if (
      rowDeviceId ===
      deviceId
    ) {

      var status =
        String(
          data[i][2] || ""
        ).trim();


      if (
        status ===
        "BLOCKED"
      ) {

        return "BLOCKED";

      }


      if (
        status ===
          "APPROVED"
        ||
        status ===
          "LIVE"
      ) {

        return "APPROVED";

      }


      if (
        status ===
        "PENDING"
      ) {

        return "PENDING";

      }

    }

  }


  return "PENDING";

}


/* =================================================
   UPDATE DEVICE RECORD
================================================= */

function updateDeviceRecord(
  deviceId,
  deviceName,
  status,
  locationInfo,
  lat,
  lng,
  accuracy
) {

  var lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    var sheet =
      getDatabaseSheet();


    var data =
      sheet
        .getDataRange()
        .getValues();


    var now =
      new Date();


    deviceId =
      String(
        deviceId || ""
      ).trim();


    for (
      var i = 1;
      i < data.length;
      i++
    ) {

      var existingId =
        String(
          data[i][0] || ""
        ).trim();


      if (
        existingId ===
        deviceId
      ) {

        if (
          String(
            data[i][2] || ""
          ) ===
          "BLOCKED"
        ) {

          return;

        }


        sheet.getRange(i + 1, 2).setValue(deviceName);
        sheet.getRange(i + 1, 3).setValue(status);
        sheet.getRange(i + 1, 4).setValue(locationInfo);
        sheet.getRange(i + 1, 5).setValue(lat);
        sheet.getRange(i + 1, 6).setValue(lng);
        sheet.getRange(i + 1, 7).setValue(accuracy);
        sheet.getRange(i + 1, 8).setValue(now);


        SpreadsheetApp.flush();

        return;

      }

    }


    sheet.appendRow([

      deviceId,

      deviceName,

      status,

      locationInfo,

      lat,

      lng,

      accuracy,

      now,

      now

    ]);


    SpreadsheetApp.flush();


  } catch (err) {

    Logger.log(
      "updateDeviceRecord ERROR: " +
      err.toString()
    );


  } finally {

    try {
      lock.releaseLock();
    } catch (e) {}

  }

}


/* =================================================
   HEARTBEAT UPDATE
================================================= */

function updateDeviceHeartbeat(
  deviceId,
  deviceName,
  locationInfo,
  lat,
  lng,
  accuracy
) {

  var sheet =
    getDatabaseSheet();


  var data =
    sheet
      .getDataRange()
      .getValues();


  var now =
    new Date();


  deviceId =
    String(
      deviceId || ""
    ).trim();


  for (
    var i = 1;
    i < data.length;
    i++
  ) {

    var existingId =
      String(
        data[i][0] || ""
      ).trim();


    if (
      existingId ===
      deviceId
    ) {

      if (
        String(
          data[i][2] || ""
        ) ===
        "BLOCKED"
      ) {

        return;

      }


      sheet.getRange(i + 1, 2).setValue(deviceName);
      sheet.getRange(i + 1, 4).setValue(locationInfo);
      sheet.getRange(i + 1, 5).setValue(lat);
      sheet.getRange(i + 1, 6).setValue(lng);
      sheet.getRange(i + 1, 7).setValue(accuracy);
      sheet.getRange(i + 1, 8).setValue(now);


      if (
        String(
          data[i][2] || ""
        ) ===
        "LIVE"
      ) {

        sheet
          .getRange(
            i + 1,
            3
          )
          .setValue(
            "APPROVED"
          );

      }


      SpreadsheetApp.flush();

      return;

    }

  }

}


/* =================================================
   UPDATE DEVICE STATUS
================================================= */

function updateDeviceStatus(
  deviceId,
  status
) {

  deviceId =
    String(
      deviceId || ""
    ).trim();


  status =
    String(
      status || ""
    ).trim();


  if (!deviceId) {
    return false;
  }


  if (
    !status
  ) {
    return false;
  }


  var lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    var sheet =
      getDatabaseSheet();


    var data =
      sheet
        .getDataRange()
        .getValues();


    for (
      var i = 1;
      i < data.length;
      i++
    ) {

      var existingId =
        String(
          data[i][0] || ""
        ).trim();


      if (
        existingId ===
        deviceId
      ) {

        sheet
          .getRange(
            i + 1,
            3
          )
          .setValue(
            status
          );


        SpreadsheetApp.flush();

        return true;

      }

    }


    var now =
      new Date();


    sheet.appendRow([

      deviceId,

      "Unknown Device",

      status,

      "",

      "",

      "",

      "",

      now,

      now

    ]);


    SpreadsheetApp.flush();


    return true;


  } catch (err) {

    Logger.log(
      "updateDeviceStatus ERROR: " +
      err.toString()
    );


    return false;


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/* =================================================
   SEND APPROVAL EMAIL
================================================= */

function sendApprovalEmail(
  deviceId,
  deviceName,
  locationInfo,
  lat,
  lng
) {

  var webAppUrl =
    ScriptApp
      .getService()
      .getUrl();


  var acceptUrl =
    webAppUrl +
    "?action=approve&deviceId=" +
    encodeURIComponent(
      deviceId
    );


  var blockUrl =
    webAppUrl +
    "?action=block&deviceId=" +
    encodeURIComponent(
      deviceId
    );


  var dashboardUrl =
    webAppUrl +
    "?action=devices";


  var mapPageUrl =
    webAppUrl +
    "?action=map";


  var mapUrl = "";


  if (
    lat &&
    lng
  ) {

    mapUrl =
      "https://www.google.com/maps?q=" +
      encodeURIComponent(
        lat + "," + lng
      );

  }


  var locationHTML =
    mapUrl

      ? `<a
           href="${mapUrl}"
           target="_blank">
            ${locationInfo}
         </a>`

      : ` ${locationInfo}`;


  var subject =
    "DJ Console Access Request - " +
    deviceName;


  var htmlBody = `

  <div style="
    font-family:Arial;
    padding:20px;
    background:#111;
    color:white;
  ">

    <h2>
      DJ Audio Console
    </h2>

    <h3>
      New Login Attempt
    </h3>

    <hr>

    <p>
      <b>Device Name:</b>
      ${deviceName}
    </p>

    <p>
      <b>Device ID:</b>
      ${deviceId}
    </p>

    <p>
      <b>Location:</b>
      ${locationHTML}
    </p>

    <br>

    <a
      href="${acceptUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:12px 22px;
        background:#00cc66;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      ✅ ACCEPT
    </a>

    &nbsp;

    <a
      href="${blockUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:12px 22px;
        background:#ff1744;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      ❌ BLOCK
    </a>

    <br><br>

    <a
      href="${dashboardUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:10px 18px;
        background:#2196f3;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      VIEW ACTIVE DEVICES
    </a>

    &nbsp;

    <a
      href="${mapPageUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:10px 18px;
        background:#ff9800;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      LIVE MAP VIEW
    </a>

  </div>

  `;


  GmailApp.sendEmail(
    ADMIN_EMAIL,

    subject,

    "DJ Console access request",

    {
      htmlBody:
        htmlBody
    }

  );

}


/* =================================================
   SEND UNBLOCK REQUEST EMAIL
================================================= */

function sendUnblockRequestEmail(
  deviceId,
  deviceName,
  locationInfo,
  lat,
  lng
) {

  var webAppUrl =
    ScriptApp
      .getService()
      .getUrl();


  var unblockUrl =
    webAppUrl +
    "?action=unblock&deviceId=" +
    encodeURIComponent(
      deviceId
    );


  var dashboardUrl =
    webAppUrl +
    "?action=devices";


  var mapPageUrl =
    webAppUrl +
    "?action=map";


  var mapUrl = "";


  if (
    lat &&
    lng
  ) {

    mapUrl =
      "https://www.google.com/maps?q=" +
      encodeURIComponent(
        lat + "," + lng
      );

  }


  var locationHTML =
    mapUrl

      ? `<a
           href="${mapUrl}"
           target="_blank">
            ${locationInfo}
         </a>`

      : ` ${locationInfo}`;


  var subject =
    " DJ Console UNBLOCK REQUEST - " +
    deviceName;


  var htmlBody = `

  <div style="
    font-family:Arial;
    padding:20px;
    background:#111;
    color:white;
  ">

    <h2>
       DJ Audio Console
    </h2>

    <h3 style="
      color:#ff1744;
    ">
      Blocked Device — Unblock Request
    </h3>

    <hr>

    <p>
      <b>Device Name:</b>
      ${deviceName}
    </p>

    <p>
      <b>Device ID:</b>
      ${deviceId}
    </p>

    <p>
      <b>Location:</b>
      ${locationHTML}
    </p>

    <br>

    <a
      href="${unblockUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:12px 22px;
        background:#00cc66;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      🔓 UNBLOCK DEVICE
    </a>

    &nbsp;

    <a
      href="${dashboardUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:10px 18px;
        background:#2196f3;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      DEVICE MANAGEMENT
    </a>

    &nbsp;

    <a
      href="${mapPageUrl}"
      target="_blank"
      style="
        display:inline-block;
        padding:10px 18px;
        background:#ff9800;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">
      LIVE MAP VIEW
    </a>

  </div>

  `;


  GmailApp.sendEmail(
    ADMIN_EMAIL,

    subject,

    "DJ Console unblock request",

    {
      htmlBody:
        htmlBody
    }

  );

}


/* =================================================
   ADMIN RESULT PAGE
================================================= */

function adminResultPage(
  title,
  message
) {

  var webAppUrl =
    ScriptApp
      .getService()
      .getUrl();


  var dashboardUrl =
    webAppUrl +
    "?action=devices";


  return `

  <!DOCTYPE html>

  <html>

  <head>

    <meta
      name="viewport"
      content="width=device-width,
               initial-scale=1.0">

    <title>
      DJ Console
    </title>

  </head>


  <body style="
    margin:0;
    background:#050505;
    color:white;
    font-family:Arial;
    display:flex;
    justify-content:center;
    align-items:center;
    min-height:100vh;
    text-align:center;
  ">

    <div style="
      padding:30px;
      max-width:600px;
    ">

      <h1>
        ${title}
      </h1>

      <p style="
        font-size:18px;
        color:#ccc;
      ">
        ${message}
      </p>

      <br>

      <a
        href="${dashboardUrl}"
        target="_top"
        style="
          display:inline-block;
          padding:13px 22px;
          background:#00cc66;
          color:white;
          text-decoration:none;
          border-radius:7px;
          font-weight:bold;
        ">
        Device Management
      </a>

    </div>

  </body>

  </html>

  `;

}


/* =================================================
   ALL DEVICES MAP PAGE (CUSTOM MAP VIEW)
================================================= */

function createAllDevicesMapPage() {

  var sheet = getDatabaseSheet();
  var data = sheet.getDataRange().getValues();
  var webAppUrl = ScriptApp.getService().getUrl();

  var devicesJson = [];

  for (var i = 1; i < data.length; i++) {
    var deviceId = data[i][0] || "";
    var deviceName = data[i][1] || "Unknown Device";
    var status = data[i][2] || "PENDING";
    var lat = data[i][4] || "";
    var lng = data[i][5] || "";
    var lastSeen = data[i][7] || "";
    var isLive = checkLive(lastSeen);

    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      devicesJson.push({
        number: i,
        deviceId: deviceId,
        deviceName: deviceName,
        status: status,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        isLive: isLive
      });
    }
  }

  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DJ Console - All Devices Map</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        body { margin:0; padding:0; background:#050505; color:#fff; font-family:Arial, sans-serif; }
        #header { padding: 15px 20px; background: #111; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
        h1 { margin:0; font-size: 22px; color: #00ffcc; }
        .back-btn { background: #2196f3; color: white; padding: 8px 14px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; }
        #map { width: 100%; height: calc(100vh - 60px); }
        .custom-marker {
          border: 2px solid white;
          border-radius: 50%;
          color: white;
          font-weight: bold;
          text-align: center;
          line-height: 26px;
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
        }
        .map-label {
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid #444;
  color: #fff;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
      </style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    </head>
    <body>
      <div id="header">
        <h1>All Devices Map Location</h1>
        <a href="${webAppUrl}?action=devices" target="_top" class="back-btn">Back to Dashboard</a>
      </div>
      <div id="map"></div>

      <script>
        var devices = ${JSON.stringify(devicesJson)};

        var map = L.map('map').setView([23.6850, 90.3563], 6);

        // ১. OpenStreetMap ভিত্তিক স্যাটেলাইট/হাইব্রিড টাইল লেয়ার ব্যবহার করা
        var satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0','mt1','mt2','mt3'],
          attribution: '© Google Maps'
        }).addTo(map);

        // ২. জায়গার নাম এবং বর্ডার দেখানোর জন্য লেবেল লেয়ার (Hybrid)
        var labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        }).addTo(map);

        var bounds = [];

        if(devices.length > 0) {
          devices.forEach(function(dev) {
            var bgColor = dev.isLive ? '#00ff66' : '#888888';
            var markerHtml = '<div class="custom-marker" style="width:30px; height:30px; background:' + bgColor + ';">' + dev.number + '</div>';
            
            var customIcon = L.divIcon({
              html: markerHtml,
              className: '',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            });

            var marker = L.marker([dev.lat, dev.lng], {icon: customIcon}).addTo(map);
            
            // পিনের ঠিক পাশেই ডিভাইসের নাম বা জায়গার নাম স্থায়ীভাবে দেখাতে চাইলে নিচের কোডটি ব্যবহার করুন
            marker.bindTooltip(dev.deviceName, {
              permanent: true, 
              direction: 'right',
              className: 'map-label'
            });

            var popupContent = "<b>#" + dev.number + " - " + dev.deviceName + "</b><br>" +
                               "ID: " + dev.deviceId + "<br>" +
                               "Status: " + dev.status + "<br>" +
                               "Live: " + (dev.isLive ? "Yes 🟢 (Active)" : "No ⚪ (Inactive)");
            
            marker.bindPopup(popupContent);
            bounds.push([dev.lat, dev.lng]);
          });

          if(bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        } else {
          alert("কোনো ডিভাইসের ভ্যালিড লোকেশন পাওয়া যায়নি!");
        }
      </script>
    </body>
    </html>
  `);
}


/* =================================================
   DEVICE MANAGEMENT DASHBOARD
================================================= */

function createDeviceDashboard() {

  var sheet =
    getDatabaseSheet();


  var data =
    sheet
      .getDataRange()
      .getValues();


  var rows = "";

  var webAppUrl =
    ScriptApp
      .getService()
      .getUrl();


  for (
    var i = 1;
    i < data.length;
    i++
  ) {

    var deviceId =
      data[i][0] || "";


    var deviceName =
      data[i][1] ||
      "Unknown Device";


    var status =
      data[i][2] ||
      "PENDING";


    var location =
      data[i][3] || "";


    var lat =
      data[i][4] || "";


    var lng =
      data[i][5] || "";


    var accuracy =
      data[i][6] || "";


    var lastSeen =
      data[i][7] || "";


    var isLive =
      checkLive(
        lastSeen
      );


    var dot =
      isLive

        ? `<span style="
             display:inline-block;
             width:10px;
             height:10px;
             background:#00ff66;
             border-radius:50%;
             box-shadow:0 0 10px #00ff66;
             margin-right:7px;
           "></span>`

        : `<span style="
             display:inline-block;
             width:10px;
             height:10px;
             background:#777;
             border-radius:50%;
             margin-right:7px;
           "></span>`;


    var statusText;


    if (
      status ===
      "BLOCKED"
    ) {

      statusText =
        "BLOCKED";

    } else if (
      isLive
    ) {

      statusText =
        "LIVE";

    } else {

      statusText =
        status;

    }


    var statusColor;


    if (
      statusText ===
      "BLOCKED"
    ) {

      statusColor =
        "#ff1744";

    } else if (
      statusText ===
      "LIVE"
    ) {

      statusColor =
        "#00ff66";

    } else if (
      statusText ===
      "APPROVED"
    ) {

      statusColor =
        "#00ccff";

    } else {

      statusColor =
        "#ffc107";

    }


    var locationDisplay =
      location ||
      "Location unavailable";


    if (
      lat &&
      lng
    ) {

      locationDisplay += `

        <br>

        <a
          href="https://www.google.com/maps?q=${encodeURIComponent(
            lat + "," + lng
          )}"
          target="_blank"
          style="
            color:#00ccff;
            text-decoration:none;
          ">
          📍 Open Map
        </a>

      `;

    }


    var actions = "";


    if (
      status ===
      "BLOCKED"
    ) {

      var unblockUrl =
        webAppUrl +
        "?action=unblock&deviceId=" +
        encodeURIComponent(
          String(deviceId)
        );


      actions = `

        <a
          href="${unblockUrl}"
          target="_top"
          onclick="
            return confirm(
              'এই Device-টি Unblock করতে চান?'
            );
          "
          style="
            display:inline-block;
            background:#00cc66;
            color:white;
            padding:9px 16px;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
            cursor:pointer;
          ">
          🔓 UNBLOCK
        </a>

      `;

    } else {

      var blockUrl =
        webAppUrl +
        "?action=block&deviceId=" +
        encodeURIComponent(
          String(deviceId)
        );


      actions = `

        <a
          href="${blockUrl}"
          target="_top"
          onclick="
            return confirm(
              'এই Device-টি BLOCK করতে চান?'
            );
          "
          style="
            display:inline-block;
            background:#ff1744;
            color:white;
            padding:9px 16px;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
            cursor:pointer;
          ">
          ❌ BLOCK
        </a>

      `;

    }


    var lastSeenText =
      "-";


    if (
      lastSeen
    ) {

      try {

        lastSeenText =
          new Date(
            lastSeen
          ).toLocaleString();

      } catch (e) {

        lastSeenText =
          String(
            lastSeen
          );

      }

    }


    var accuracyHTML =
      accuracy

        ? `<br>
           <small>
             Accuracy: ${accuracy} m
           </small>`

        : "";


    /*
     * TABLE ROW (With Numbering i)
     */

    rows += `

      <tr>

        <td style="font-weight:bold; color:#00ffcc; text-align:center;">
          ${i}
        </td>

        <td>
          ${dot}
          <b>
            ${deviceName}
          </b>
        </td>


        <td style="
          font-size:11px;
          word-break:break-all;
        ">
          ${deviceId}
        </td>


        <td style="
          color:${statusColor};
          font-weight:bold;
        ">
          ${statusText}
        </td>


        <td>
          ${locationDisplay}
          ${accuracyHTML}
        </td>


        <td>
          ${lastSeenText}
        </td>


        <td>
          ${actions}
        </td>

      </tr>

    `;

  }


  return HtmlService
    .createHtmlOutput(`

      <!DOCTYPE html>

      <html>

      <head>

        <meta
          name="viewport"
          content="
            width=device-width,
            initial-scale=1.0
          ">

        <title>
          DJ Console Device Management
        </title>


        <style>

          * {
            box-sizing:border-box;
          }


          body {

            margin:0;

            background:#050505;

            color:#eee;

            font-family:
              Arial,
              sans-serif;

          }


          .header {

            padding:20px;

            background:#111;

            border-bottom:
              1px solid #333;

          }


          h1 {

            margin:0;

            color:#00ffcc;

            font-size:32px;

          }


          .live {

            color:#00ff66;

          }


          .btn-group {
            margin-top: 10px;
          }


          .refresh {

            display:inline-block;

            padding:
              10px 16px;

            background:#2196f3;

            color:white;

            text-decoration:none;

            border-radius:6px;

            font-weight:bold;
            margin-right: 10px;

          }

          .map-btn {

            display:inline-block;

            padding:
              10px 16px;

            background:#ff9800;

            color:white;

            text-decoration:none;

            border-radius:6px;

            font-weight:bold;

          }


          table {

            width:100%;

            border-collapse:
              collapse;

          }


          th {

            background:#181818;

            color:#00ffcc;

            padding:14px;

            text-align:left;

          }


          td {

            padding:12px;

            border-bottom:
              1px solid #222;

          }


          tr:hover {

            background:#151515;

          }


          @media(max-width:800px) {

            h1 {
              font-size:24px;
            }

            table {
              font-size:13px;
            }

            th,
            td {
              padding:8px;
            }

          }


        </style>


        <script>

          setTimeout(
            function() {

              window.location.href =
                "${webAppUrl}?action=devices";

            },
            15000
          );

        </script>


      </head>


      <body>


        <div class="header">

          <h1>
            🎧 DJ Console Device Management
          </h1>


          <p>

            🟢

            <span class="live">
              Green Dot = Device is LIVE
            </span>

          </p>


          <div class="btn-group">
            <a
              href="${webAppUrl}?action=devices"
              target="_top"
              class="refresh">
              🔄 Refresh
            </a>

            <a
              href="${webAppUrl}?action=map"
              target="_top"
              class="map-btn">
              🗺️ View All Devices Map
            </a>
          </div>

        </div>


        <div style="
          overflow-x:auto;
        ">

          <table>

            <tr>

              <th>#</th>

              <th>
                Device
              </th>

              <th>
                Device ID
              </th>

              <th>
                Status
              </th>

              <th>
                Location
              </th>

              <th>
                Last Seen
              </th>

              <th>
                Action
              </th>

            </tr>


            ${rows}


          </table>

        </div>


      </body>

      </html>

    `);

}


/* =================================================
   LIVE CHECK
================================================= */

function checkLive(
  lastSeen
) {

  if (!lastSeen) {

    return false;

  }


  var lastTime =
    new Date(
      lastSeen
    ).getTime();


  if (
    isNaN(lastTime)
  ) {

    return false;

  }


  var now =
    new Date().getTime();


  var diff =
    (
      now -
      lastTime
    ) / 1000;


  return (
    diff <=
    LIVE_TIMEOUT_SECONDS
  );

}