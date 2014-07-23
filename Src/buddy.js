

window.Buddy = function(root) {

	root = root || "https://api.buddyplatform.com"

	var buddy = {};

	
	var _appId;
	var _appKey;
	var _options;
	var _settings;


	function supports_html5_storage() {
	  try {
	    return 'localStorage' in window && window['localStorage'] !== null;
	  } catch (e) {
	    return false;
	  }
	}

	function getSettings(force) {
		if ((!_settings || force) && supports_html5_storage() && _appId) {

			var json = window.localStorage.getItem(_appId);
			_settings = JSON.parse(json);
		}
		return _settings || {};
	}

	function updateSettings(updates, replace) {
		if (supports_html5_storage() && _appId) {


			var settings = updates;

			if (!replace) {
				settings = getSettings();
				for (var key in updates) {
					settings[key] = updates[key];
				}
			}

			if (!_options.nosave) {
			    window.localStorage.setItem(_appId, JSON.stringify(settings));
			}
			_settings = settings;
			return _settings;
		}

	}

	function clearSettings(type) {
		if (supports_html5_storage() && _appId) {

			if (!type) {
				window.localStorage.removeItem(_appId);
				_settings = {}
			}
			else {

				var s = getSettings();
				for (var key in s) {

					var remove = type.device && key.indexOf("device") === 0 ||
								 type.user && key.indexOf("user") === 0;
					if (remove) {
						delete s[key];
					}
				}
				return updateSettings(s, true);
			}
		}
	}


	function getUniqueId() {

		var s = getSettings();

		if (!s.unique_id) {
			
			s = updateSettings({
				unique_id: _appId + ":" +new Date().getTime() // good enough for this
			})
		}
		
		return s.unique_id;
	}
	

	function getAccessToken() {

		var s = getSettings();
		
		var token = s.user_token || s.device_token;

		if (token && (!token.expires || token.expires > new Date().getTime())) {
			return token.value;
		}
		return null;
	}

	
	function setAccessToken(type, value) {


		if (value) {
			
			value = {
				value: value.accessToken,
				expires: value.accessTokenExpires.getTime()
			}
		}

		var update = {};

		update[type + "_token"] = value;

		updateSettings(update);
	}

	
	function loadCreds() {
		var s = getSettings();

		if (s && s.app_id) {
			_appId = s.app_id;
			_appKey = s.app_key;
			getAccessToken();
		}
	}

	loadCreds();

	buddy.init = function(appId, appKey, callback, options) {

		_options = options || {};

		_appId = appId;

		if (!_appId) throw new Error("appId and appKey required");

		_appKey = appKey;

		if (_options.root) {
			root = options.root;
		}

		getSettings(true);

		buddy.registerDevice(appId, appKey, callback);
	}

	buddy.clear = function() {

		clearSettings();
	}

	//
	// HELPER METHODS -
	// We wrap a few common operations.
	//

	buddy.registerDevice = function(appId, appKey, callback) {

		if (getAccessToken()) {
			callback && callback();
			return;
		}

		var cb = function (err, r) {
		    if (r.success) {
		        _appId = appId || _appId;
		        _appKey = appKey || _appKey;
		        updateSettings({ app_id: _appId, app_key: appKey, service_root: r.result.serviceRoot });
		        setAccessToken("device", r.result);
		        console.log("Device Registration Complete.");
		        callback && callback(err, r);
		    }
		    else {
		        processResult(r, callback);
		    }

		};

		cb._hasUserCallback = callback;


		return buddy.post("/devices", {
			appID: appId || _appId,
			appKey: appKey || _appKey,
			platform: _options.platform || "Javascript",
			model: navigator.userAgent,
			uniqueId: getUniqueId()
		},cb, true)
	}

	buddy.getUser = function(callback) {

		var s = getSettings();

		if (!s.user_id) {
			return callback && callback();
		}

		if (callback) {

			buddy.get("/users/me", function(err, r){

				callback && callback(err, r.result);
			});
		}

		return s.user_id;
	}

	Object.defineProperty(buddy, "accessToken", {
	    get: function() {
	        return getAccessToken();
	    }
	});

	buddy.loginUser = function(username, password, callback) {

		var cb = function(err, r){
			if (r.success) {
				var user = r.result;
				updateSettings({
					user_id: user.id
				});

				setAccessToken('user', user);
			
			}
			callback && callback(err, r && r.result);
		};

		cb._hasUserCallback = callback;

		return buddy.post("/users/login", {
			username: username,
			password: password
		}, cb);
		
	}

	buddy.socialLogin = function(identityProviderName, identityID, identityAccessToken, callback) {

		var cb = function(err, r){
			if (r.success) {
				var user = r.result;
				updateSettings({
					user_id: user.id
				});

				setAccessToken('user', user);
			}
			callback && callback(err, r && r.result);
		};

		cb._hasUserCallback = callback;

		return buddy.post("/users/login/social", {
			identityID: identityID,
			identityProviderName: identityProviderName,
			identityAccessToken: identityAccessToken
		}, cb);
	}

	buddy.logoutUser = function(callback) {

		var s = getSettings();
		var userId = s.user_id;

		if (!userId) {
			return callback && callback();
		}

		return buddy.post('/users/me/logout', function(){

				clearSettings({
					user: true
				})

				callback && callback();

		});
		
	}

	buddy.createUser = function(options, callback) {

		
		if (!options.username || !options.password) {
			throw new Error("Username and password are required.");
		}

		return buddy.post("/users", options, function(err, r){

			if (r.success) {
				var user = r.result;
				updateSettings({
						user_id: user.id
					});
				setAccessToken('user', user);
			}
			callback && callback(err, r && r.result);
		});
		
	}

	//
	// Record an 
	//
	buddy.recordMetricEvent = function(eventName, values, timeoutInSeconds, callback) {

		if (typeof timeoutInMinutes == 'function') {
			callback = timeoutInMinutes;
			timeoutInMinutes = null;
		}

		var cb = function(err, result){

			if (err) {
				callback && callback(err);
			}
			else if (timeoutInSeconds && result.result) {
				var r2 = {
					 finish: function(values2, callback2){
					 	if (typeof values2 == 'function') {
					 		callback2 = values2;
					 		values2 = null;
					 	}
						buddy.delete(
							'/metrics/events/' + result.result.id, 
							{
									values: values
							}, 
							function(err){
								callback2 && callback2(err);
							});
					}
				};
				callback && callback(null, r2);
			}
			else {
				callback && callback(err, result);
			}
		};
		cb._hasUserCallback = callback;

		return buddy.post("/metrics/events/" + eventName, {
			values: values,
			timeoutInSeconds: timeoutInSeconds
		}, cb);


	}

	// just let things unwind a bit, mmk?
	function defer(callback) {

		if (!callback) return;

		setTimeout(function() {
			var args = Array.prototype.slice.call(arguments, 2);
			callback.apply(null, args);
		}, 0);
	}

	var AuthErrors = {
		AuthFailed :                        0x100,
		AuthAccessTokenInvalid :            0x104,
		AuthUserAccessTokenRequired :       0x107,
		AuthAppCredentialsInvalid :         0x105
	}


	var _requestCount = 0;

	function startRequest() {
		_requestCount++;
	}

	function processResult(result, callback) {

		_requestCount--;
		
		result.success = !result.error && typeof result.result != 'undefined';

		if (result.error) {
			var err = new Error(result.message || result.error);
			err.error = result.error;
			err.errorNumber = result.errorNumber;
			err.status = result.status;

			callback && callback(err, result);
			if (!callback || !callback._hasUserCallback) {
				console.warn(JSON.stringify(result,  null, 2));
				$.event.trigger({
					type: "BuddyError",
					buddy: result
				});
			}
		}
		else {
			convertDates(result.result);
			callback && callback(null, result);
			if (!callback || !callback._hasUserCallback) {
				console.log(JSON.stringify(result,  null, 2));
			}
		}
	}

	//
	// Convert dates format like /Date(124124)/ to a JS Date, recursively
	//
	function convertDates(obj, seen) {

		seen = seen || {};

		if (!obj || seen[obj]) {
			return;
		}

		// prevent loops
		seen[obj] = true;

		for (var key in obj) {
			var val = obj[key];
			if (typeof val ==  'string') {
				var match = val.match(/\/Date\((\d+)\)\//);
				if (match) {
					obj[key] = new Date(Number(match[1]));
				}
			}
			else if (typeof value == 'object') {
				convertDates(obj);
			}
		}
		return obj;
	}

	//
	// The main caller request, handles call setup and formatting,
	// authentication, and basic error conditions such as triggering the login
	// callback or no internet callback.
	//
	function makeRequest(method, url, parameters, callback, noAutoToken) {

		if (!method || !url) {
			throw new Error("Method and URL required.")
		}
		method = method.toUpperCase();

		if (typeof parameters == 'function') {
			callback = parameters;
			parameters = null;
		}

		// see if we've already got an access token
		var at = getAccessToken();
		
		if (at && !_appKey) {
			return callback(new Error("Init must be called first."))
		}
		else if (!at && !noAutoToken) {
			// if we don't have an access token, automatically get the device
			// registered, then retry this call.
		    //
		    var cb = function (err, r1) {
		        if (!err && r1.success) {
		            at = getAccessToken();

		            if (at) {
		                makeRequest(method, url, parameters, callback);
		                return;
		            }
		        }
		        else {
		            callback(err);
		        }
		    };
		    cb._hasUserCallback = true;
			buddy.registerDevice(null, null, cb)
			return;
		}

		// we love JSON.
		var headers = {
				"Accept" : "application/json"
		};

		// if it's a get, encode the parameters
		// on the URL
		//
		if (method == "GET" && parameters != null) {
			url += "?"
			for (var k in parameters) {
				var v = parameters[k];
				if (v) {
					url += k + "=" + encodeURIComponent(v.toString()) + "&"
				}
			}
			parameters = null;
		}
		else if (parameters != null) {
			headers["Content-Type"] = "application/json";
		}

		if (at) {
			headers["Authorization"] = "Buddy " + at;
		}

		// look for file parameters
		//
		if (parameters) {

			var fileParams = null;
			var nonFileParams = null;

			for (var name in parameters) {
				var val = parameters[name];

				if (val instanceof File || (typeof Blob !== "undefined" && val instanceof Blob)) {
					fileParams = {} || fileParams;
					fileParams[name] = val;
				}
				else {
					nonFileParams = nonFileParams || {}
					nonFileParams[name] = val;
				}
			}

			if (fileParams) {

				if (method == "GET") {
					throw new Error("Get does not support file parameters.");
				}

				if (!FormData) {
					throw new Error("Sorry, this browser doesn't support FormData.");
				}

				// for any file parameters, build up a FormData object.

				// should we make this "multipart/form"?
				delete headers["Content-Type"];

				var formData = new FormData();

				// push in any file parameters
                for (var p in fileParams) {
                        formData.append(p, fileParams[p]);
                }

                // the rest of the params go in as a single JSON entity named "body"
                //
                if (nonFileParams) {
	                formData.append("body", new Blob([JSON.stringify(nonFileParams)], {type:'application/json'}));
	            }
                parameters = formData;

			}
			else {
				// if we just have normal params, we stringify and push them into the body.
				parameters = nonFileParams ? JSON.stringify(nonFileParams) : null;
			}
		}
		
		// OK, let's make the call for realz
		//
		var s = getSettings();
		var r = s.service_root || root;
	    $.ajax({
	        method: method,
            type: method,
			url: r + url,
			headers: headers,
			contentType: false,
			processData: false,
			data: parameters,
            success:function(data) {
				processResult(data, callback);
			},
			error: function(data, status, response) {

				// chekc our eror states, then continue to process result
				if (data.status === 0) {
					data = {
						status: 0,
						error: "NoInternetConnection",
						errorNumber: -1
					};
					console.warn("ERROR: Can't connect to Buddy Platform.");
					_options && _options.connectionStateChanged && defer(_options.connectionStateChagned);
				}
				else {
					data = JSON.parse(data.responseText);
					switch (data.errorNumber) {
						case AuthErrors.AuthAccessTokenInvalid:
						case AuthErrors.AuthAppCredentialsInvalid:
							// if we get either of those, drop all our app state.
							// 
							clearSettings();
							break;
						case AuthErrors.AuthUserAccessTokenRequired:
							clearSettings({user:true});
							_options && _options.loginRequired && defer(_options.loginRequired);
							break;
					}
				}
				processResult(data, callback);
			}
		});
		return 'Waiting for ' + url + "..."
	}

	buddy.get = function(url, parameters, callback, noAuto) {
		return makeRequest("GET", url, parameters, callback, noAuto);
	}

	buddy.post = function(url, parameters, callback, noAuto) {
		return makeRequest("POST", url, parameters, callback, noAuto);
	}

	buddy.put = function(url, parameters, callback, noAuto) {
		return makeRequest("PUT", url, parameters, callback, noAuto);
	}

	buddy.patch = function(url, parameters, callback, noAuto) {
		return makeRequest("PATCH", url, parameters, callback, noAuto);
	}

	buddy.delete = function(url, parameters, callback, noAuto) {
		return makeRequest("DELETE", url, parameters, callback, noAuto);
	}

	return buddy;
}();
