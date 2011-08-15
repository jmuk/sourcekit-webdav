// should be rewritten when launched.
var sourcekit_id = 'ojgeljdaokhhalobabfpilepcejhfkmh';
var base_path = '/shared';
var registered = false;

function _normalizePath(path) {
  var result = path;
  if (result[0] != '/') {
    result = '/' + result;
  }
  return result;
}

function _createXHR(method, path, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, 'http://localhost' + base_path + path, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState != 4) {
      return;
    }
    callback(xhr);
  };
  return xhr;
}

function _getContent(request, callback) {
  var path = _normalizePath(request.path);
  var xhr = _createXHR('GET', path, function(xhr) {
    if (xhr.status == 304) {
      var content = localStorage.getItem('content-' + path);
      if (!content) {
        content = '';
      }
      callback({content: content});
      return;
    }

    var etag = xhr.getResponseHeader('ETag');
    if (etag) {
      localStorage.setItem('etag-' + path, etag);
      localStorage.setItem('content-' + path, xhr.responseText);
    }
    callback({content: xhr.responseText});
  });
  var etag = localStorage.getItem('etag-' + path);
  if (etag) {
    xhr.setRequestHeader('If-None-Match', etag);
  }
  xhr.send();
}

function _setContent(request, callback) {
  var path = _normalizePath(request.path);
  var xhr = _createXHR('PUT', path, function(xhr) {
    if (Math.floor(xhr.status / 100) != 2) {
      callback({result: false});
    } else {
      callback({result: true});
    }
  });
  xhr.send(request.content);
}

function _getDirectoryContent(request, callback) {
  var path = _normalizePath(request.path);
  var xhr = _createXHR('PROPFIND', path, function(xhr) {
    var children = [];
    if (xhr.responseXML &&
        xhr.responseXML.firstChild.tagName == 'D:multistatus') {
      var elems = xhr.responseXML.firstChild.childNodes;
      for (var i = 0; i < elems.length; ++i) {
        var item = {};
        var elem = elems[i];
        if (elem.nodeType != 1 || elem.tagName != 'D:response') {
          continue;
        }
        item.path = elem.getElementsByTagName('href')[0].textContent;
        item.path = item.path.slice(base_path.length);
        item.label = item.path.slice(path.length);
        if (item.path == path) {
          // skip the data for the directory itself.
          continue;
        }
        var contentType = elem.getElementsByTagName('getcontenttype');
        if (contentType == null || contentType.length == 0) {
          console.log('no content type -- ignored');
          console.log(item.path);
          continue;
        }
        contentType = contentType[0].textContent;
        if (/^text\//.exec(contentType)) {
          // text files.
          item.is_dir = false;
          children.push(item);
        } else if (contentType == 'httpd/unix-directory') {
          // directory.
          item.is_dir = true;
          item.children = [];
          children.push(item);
        }
      }
    }
    var response = {children: children};
    callback(response);
  });
  xhr.setRequestHeader('Depth', '1');
  xhr.send();
}

function _newItem(request, callback) {
  var method = request.is_dir ? 'MKCOL' : 'PUT';
  var xhr = _createXHR(method, _normalizePath(request.path), function(xhr) {
    if (Math.floor(xhr.status / 100) == 2) {
      callback({result: true});
    } else {
      callback({result: false});
    }
  });
  var requestBody = request.is_dir ? null : '';
  xhr.send(requestBody);
}

function _deleteItem(request, callback) {
  var xhr = _createXHR('DELETE', _normalizePath(request.path), function(xhr) {
    if (Math.floor(xhr.status / 100) == 2) {
      callback({result: true});
    } else {
      callback({result: false});
    }
  });
  var requestBody = request.is_dir ? null : '';
  xhr.send(requestBody);
}

function dispatchEvent(request, sender, sendResponse) {
  var methods = {
    getContent: _getContent,
    setContent: _setContent,
    getDirectoryContent: _getDirectoryContent,
    newItem: _newItem,
    deleteItem: _deleteItem
  };
  if (sender.id != sourcekit_id) {
    return;
  }
  if (!(request.method in methods)) {
    console.log('no such method: ' + request.method);
    return;
  }

  methods[request.method](request, sendResponse);
}

function registerToSourcekit() {
  // This id is for development in mymachine.  Need to be replaced.
  var request = {
    SourceKitRegistration: true,
    name: 'WebDav'
  };
  console.log('sending request');
  chrome.extension.onRequestExternal.addListener(dispatchEvent);
  chrome.extension.sendRequest(sourcekit_id, request, function(result) {
    registered = result;
  });
};

function registerRepeatedly() {
  // Call the registration method repeatedly.
  registerToSourcekit();
  var waitTime = 10; /* sec */
  window.setTimeout(registerRepeatedly, waitTime * 1000);
}

window.addEventListener('load', registerRepeatedly);
