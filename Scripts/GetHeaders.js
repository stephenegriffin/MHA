/**
 * GetHeader.js
 * 
 * This file has all the methods to get PR_TRANSPORT_MESSAGE_HEADERS
 * from the current message via REST.
 * 
 * To use this file, your page JS needs to implement the following methods:
 * 
 * - updateStatus(message): Should be a method that displays a status to the user,
 *   preferably with some sort of activity indicator (spinner)
 * - hideStatus: Method to hide the status displays
 * - showError(message): Method to communicate an error to the user.
 * - getHeadersComplete(headers): Callback to receive headers.
 */

function sendHeadersRequest() {
  updateStatus(ImportedStrings.mha_RequestSent);

  Office.context.mailbox.getCallbackTokenAsync({ isRest: true }, function (result) {
    if (result.status === 'succeeded') {
      var accessToken = result.value;
      getHeaders(accessToken);
    } else {
      showError('Unable to obtain callback token.');
    }
  });
}

function getItemRestId() {
  // Currently the only Outlook Mobile version that supports add-ins
  // is Outlook for iOS.
  if (Office.context.mailbox.diagnostics.hostName === 'OutlookIOS') {
    // itemId is already REST-formatted
    return Office.context.mailbox.item.itemId;
  } else {
    // Convert to an item ID for API v2.0
    return Office.context.mailbox.convertToRestId(
      Office.context.mailbox.item.itemId,
      Office.MailboxEnums.RestVersion.v2_0
    );
  }
}

function getRestUrl(accessToken) {
  // Shim function to workaround
  // mailbox.restUrl == null case
  if (Office.context.mailbox.restUrl) {
    return Office.context.mailbox.restUrl;
  }
  
  // parse the token
  var jwt = jwt_decode(accessToken);

  // 'aud' parameter from token can be in a couple of 
  // different formats.

  // Format 1: It's just the URL
  if (jwt.aud.match(/https:\/\/([^@]*)/)) {
    return jwt.aud;
  }

  // Format 2: GUID/hostname@GUID
  var match = jwt.aud.match(/\/([^@]*)@/);
  if (match && match[1]) {
    return 'https://' + match[1];
  }

  // Couldn't find what we expected, default to
  // outlook.office.com
  return 'https://outlook.office.com';
}

function getHeaders(accessToken) {
  // Get the item's REST ID
  var itemId = getItemRestId();
  // Office.context.mailbox.restUrl appears to always be null, so we hard code our url
  var getMessageUrl = getRestUrl(accessToken) +
    '/api/v2.0/me/messages/' +
    itemId +
    // PR_TRANSPORT_MESSAGE_HEADERS
    '?$select=SingleValueExtendedProperties&$expand=SingleValueExtendedProperties($filter=PropertyId eq \'String 0x007D\')';
  debugOut('REST URL: ' + getMessageUrl);
  debugOut('Access Token: ' + accessToken);

  $.ajax({
    url: getMessageUrl,
    dataType: 'json',
    headers: { 
      'Authorization': 'Bearer ' + accessToken,
      'Accept': 'application/json; odata.metadata=none'
    }
  }).done(function(item) {
    getHeadersComplete(item.SingleValueExtendedProperties[0].Value);
  }).fail(function(error) {
    showError(JSON.stringify(error, null, 2));
  }).always(function() {
    hideStatus();
  });
}