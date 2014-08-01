window.Buddy =  function (root) {
	var buddy = {};


	function supports_html5_storage(){
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch (e) {
			return false;
		}
	}

	function _calculateClientKey(appId, options){
		return appId + options.instanceName;
	}

	
	function BuddyClient(appId, appKey, settings){
		if(!appId)
		{
			throw "appId must be given on a BuddyClient";
		}
		this._appId = appId;
		if(!appKey)
		{
			throw "appKey must be given on a BuddyClient";
		}
		this._appKey = appKey;

		// set the settings so we pick up the instanceName
		//
		this._settings = settings;

		this._settings = getSettings(this, true);


		if (settings) {
			for (var k in settings) {
				this._settings[k] = settings[k];
			}
		}

		this.root = this._settings.root || "https://api.buddyplatform.com"
		this._settings.root = this.root;
		this._requestCount = 0;

		this._output = settings.output || console;

		function startRequest() {
			this._requestCount++;
		}
	}
	
	function getSettings(client, force) {
		if ((!client._settings || force) && supports_html5_storage() && client._appId) {

			var json = window.localStorage.getItem(_calculateClientKey(client._appId, client._settings));
			client._settings = JSON.parse(json);
		}
		return client._settings || {};
	}
	
    function updateSettings(client, updates, replace) {
		if (supports_html5_storage() && client._appId) {
			var settings = updates;

			if (!replace) {
				settings = getSettings(client);
				for (var key in updates) {
					settings[key] = updates[key];
				}
			}

			if (!client._settings.nosave) {
			    window.localStorage.setItem(_calculateClientKey(client._appId, client._settings), JSON.stringify(settings));
			}
			client._settings = settings;
			return client._settings;
		}
	}

	function clearSettings(client, type) {
		if (supports_html5_storage() && client._appId) {

			if (!type) {
				window.localStorage.removeItem(_calculateClientKey(client._appId, client._settings));
				client._settings = {}
			}
			else {

				var s = getSettings(client);
				for (var key in s) {

					var remove = type.device && key.indexOf("device") === 0 ||
								 type.user && key.indexOf("user") === 0;
					if (remove) {
						delete s[key];
					}
				}
				return updateSettings(client, s, true);
			}
		}
	}
    
	function getUniqueId(client) {
		var s = getSettings(client);

		if (!s.unique_id) {
			
			s = updateSettings(client, {
				unique_id: client._appId + ":" +new Date().getTime() // good enough for this
			})
		}
		
		return s.unique_id;
	}
	
	function getAccessToken(client) {
		var s = getSettings(client);
		
		var token = s.user_token || s.device_token;

		if (token && (!token.expires || token.expires > new Date().getTime())) {
			return token.value;
		}
		return null;
	}
    	
	function setAccessToken(client, type, value) {
		if (value) {
			
			value = {
				value: value.accessToken,
				expires: value.accessTokenExpires.getTime()
			}
		}

		var update = {};

		update[type + "_token"] = value;

		updateSettings(client, update);
	}
    	
	function loadCreds(client) {
		var s = getSettings(client);

		if (s && s.app_id) {
			client._appId = s.app_id;
			client._appKey = s.app_key;
			getAccessToken(client);
		}
	}
	
	BuddyClient.prototype.registerDevice = function(appId, appKey, callback){
		if (getAccessToken(this)) {
			callback && callback();
			return;
		}

		var self = this;
		
		var cb = function (err, r) {
		    if (r.success) {
		        self._appId = appId || self._appId;
		        self._appKey = appKey || self._appKey;
				var newSettings = {app_id: self._appId, app_key: self._appKey};
				if(r.result.serviceRoot)
				{
					newSettings["serviceRoot"] = r.result.serviceRoot;
				}
		        updateSettings(newSettings);
		        setAccessToken(self, "device", r.result);
		        self._output && self._output.log && self._output.log("Device Registration Complete.");
		        callback && callback(err, r);
		    }
		    else {
		        processResult(this, r, callback);
		    }

		};

		cb._printResult = !callback;

		return this.post("/devices", {
			appID: appId || this._appId,
			appKey: appKey || this._appKey,
			platform: this._settings.platform || "Javascript",
			model: navigator.userAgent,
			uniqueId: getUniqueId(this)
		},cb, true)
	}
	
	BuddyClient.prototype.getUser = function(callback) {

		var s = getSettings(this);

		if (!s.user_id) {
			return callback && callback();
		}

		if (callback) {

			this.get("/users/me", function(err, r){

				callback && callback(err, r.result);
			});
		}

		return s.user_id;
	}

	BuddyClient.prototype.loginUser = function(username, password, callback) {
		var self = this;
		
		var cb = function(err, r){
			if (r.success) {
				var user = r.result;
				updateSettings(self, {
					user_id: user.id
				});

				setAccessToken(self, 'user', user);
			
			}
			callback && callback(err, r && r.result);
		};

		cb._printResult = !callback;

		return this.post("/users/login", {
			username: username,
			password: password
		}, cb);
		
	}

	BuddyClient.prototype.logoutUser = function(callback) {
		var s = getSettings(this);
		var userId = s.user_id;

		if (!userId) {
			return callback && callback();
		}

		return this.post('/users/me/logout', function(){

				clearSettings({
					user: true
				})

				callback && callback();
		});
	}

	BuddyClient.prototype.createUser = function(options, callback) {
		if (!options.username || !options.password) {
			throw new Error("Username and password are required.");
		}

		var self = this;
		var cb = function(err, r){

			if (r.success) {
				var user = r.result;
				updateSettings(self, {
						user_id: user.id
					});
				setAccessToken(self, 'user', user);
			}
			callback && callback(err, r && r.result);
		}
		cb._printResult = !callback;
		return this.post("/users", options, cb);
	}

	BuddyClient.prototype.recordMetricEvent = function(eventName, values, timeoutInSeconds, callback) {
		if (typeof timeoutInMinutes == 'function') {
			callback = timeoutInMinutes;
			timeoutInMinutes = null;
		}
		var self = this;
		
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
						self.delete(
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
		cb._printResult = !callback;

		return this.post("/metrics/events/" + eventName, {
			values: values,
			timeoutInSeconds: timeoutInSeconds
		}, cb);
	}
	
	function processResult(client, result, callback) {
		client._requestCount--;
		
		result.success = !result.error;

		if (result.error) {
			var err = new Error(result.message || result.error);
			err.error = result.error;
			err.errorNumber = result.errorNumber;
			err.status = result.status;

			callback && callback(err, result);
			if (!callback || callback._printResult) {
				client._output && client._output.warn && client._output.warn(JSON.stringify(result,  null, 2));
				$.event.trigger({
					type: "BuddyError",
					buddy: result
				});
			}
		}
		else {
			convertDates(result.result);
			callback && callback(null, result);
			if (!callback || callback._printResult) {
				client._output && client._output.log && client._output.log(JSON.stringify(result,  null, 2));
			}
		}
	}
	
	function makeRequest(client, method, url, parameters, callback, noAutoToken) {
		if (!method || !url) {
			throw new Error("Method and URL required.")
		}
		method = method.toUpperCase();

		if (typeof parameters == 'function') {
			callback = parameters;
			parameters = null;
		}

		// see if we've already got an access token
		var at = getAccessToken(client);
		
		if (at && !client._appKey) {
			return callback(new Error("Init must be called first."))
		}
		else if (!at && !noAutoToken) {
			// if we don't have an access token, automatically get the device
			// registered, then retry this call.
		    //
		    var cb = function (err, r1) {
		        if (!err && r1.success) {
		            at = getAccessToken(client);

		            if (at) {
		                makeRequest(client, method, url, parameters, callback);
		                return;
		            }
		        }
		        else {
		            callback(err, r1);
		        }
		    };
		    cb._printResult = false;
			client.registerDevice(null, null, cb)
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

				if (val instanceof File) {
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
		var s = getSettings(client);
		var r = s.root || root;
		
		var self = client;
	    $.ajax({
	        method: method,
            type: method,
			url: r + url,
			headers: headers,
			contentType: false,
			processData: false,
			data: parameters,
            success:function(data) {
				processResult(self, data, callback);
			},
			error: function(data, status, response) {

				// check our error states, then continue to process result
				if (data.status === 0) {
					data = {
						status: 0,
						error: "NoInternetConnection",
						errorNumber: -1
					};
					console.warn("ERROR: Can't connect to Buddy Platform (" + r + ")");
					self._settings && self._settings.connectionStateChanged && defer(self._settings.connectionStateChanged);
				}
				else {
					data = JSON.parse(data.responseText);
					switch (data.errorNumber) {
						case AuthErrors.AuthAccessTokenInvalid:
						case AuthErrors.AuthAppCredentialsInvalid:
							// if we get either of those, drop all our app state.
							// 
							clearSettings(client);
							break;
						case AuthErrors.AuthUserAccessTokenRequired:
							clearSettings(client, {user:true});
							self._settings && self._settings.loginRequired && defer(self._settings.loginRequired);
							break;
					}
				}
				processResult(self, data, callback);
			}
		});
		return 'Waiting for ' + url + "..."
	}

	BuddyClient.prototype.get = function(url, parameters, callback, noAuto) {
		return makeRequest(this, "GET", url, parameters, callback, noAuto);
	}

	BuddyClient.prototype.post = function(url, parameters, callback, noAuto) {
		return makeRequest(this, "POST", url, parameters, callback, noAuto);
	}

	BuddyClient.prototype.put = function(url, parameters, callback, noAuto) {
		return makeRequest(this, "PUT", url, parameters, callback, noAuto);
	}

	BuddyClient.prototype.patch = function(url, parameters, callback, noAuto) {
		return makeRequest(this, "PATCH", url, parameters, callback, noAuto);
	}

	BuddyClient.prototype.delete = function(url, parameters, callback, noAuto) {
		return makeRequest(this, "DELETE", url, parameters, callback, noAuto);
	}

	BuddyClient.prototype.getUniqueId = function() {
		var s = getSettings(this);

		if (!s.unique_id) {
			
			s = updateSettings(this, {
				unique_id: this._appId + ":" +new Date().getTime() // good enough for this
			})
		}
		
		return s.unique_id;
	}

	BuddyClient.prototype.socialLogin = function(identityProviderName, identityID, identityAccessToken, callback){
		var cb = function(err, r){
			if (r.success) {
				var user = r.result;
				updateSettings(this, {
					user_id: user.id
				});

				setAccessToken(this, 'user', user);
			}
			callback && callback(err, r && r.result);
		};

		cb._printResult = !callback;

		return this.post("/users/login/social", {
			identityID: identityID,
			identityProviderName: identityProviderName,
			identityAccessToken: identityAccessToken
		}, cb);
	}

	
	
	
	_clients = {};
	_client = null;
	
	buddy.init = function(appId, appKey, options) {
		if (!appId) throw new Error("appId and appKey required");
		
		var clientKey = _calculateClientKey(appId, options);
		
		if(!_clients[clientKey]){
			_clients[clientKey] = new BuddyClient(appId, appKey, options);
		}
		
		_client = _clients[clientKey];
		
		return _client;
	}

	clear = function() {
		clearSettings(_client);
	}

	// HELPER METHODS -
	// We wrap a few common operations.
	buddy.registerDevice = function(appId, appKey, callback) {
		return _client.registerDevice(appId, appKey, callback);
	}

	buddy.getUser = function(callback) {
		return _client.getUser(callback);
	}

	Object.defineProperty(buddy, "accessToken", {
	    get: function() {
	        return getAccessToken(_client);
	    }
	});

	buddy.loginUser = function(username, password, callback) {
		return _client.loginUser(username, password, callback);
	}

	buddy.socialLogin = function(identityProviderName, identityID, identityAccessToken, callback) {
		return _client.socialLogin(identityProviderName, identityID, identityAccessToken, callback);
	}

	buddy.logoutUser = function(callback) {
		return _client.logoutUser(callback);
	}

	buddy.createUser = function(options, callback) {
		return _client.createUser(options, callback);
	}

	// Record an 
	buddy.recordMetricEvent = function(eventName, values, timeoutInSeconds, callback) {
		return _client.recordMetricEvent(eventName, values, timeoutInSeconds, callback);
	}

	// just let things unwind a bit, mmk?
	var defer = function(callback) {
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

	//
	// Convert dates format like /Date(124124)/ to a JS Date, recursively
	//
	var convertDates = function(obj, seen) {
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
	buddy.get = function(url, parameters, callback, noAuto) {
		return _client.get(url, parameters, callback, noAuto);
	}

	buddy.post = function(url, parameters, callback, noAuto) {
		return _client.post(url, parameters, callback, noAuto);
	}

	buddy.put = function(url, parameters, callback, noAuto) {
		return _client.put(url, parameters, callback, noAuto);
	}

	buddy.patch = function(url, parameters, callback, noAuto) {
		return _client.patch(url, parameters, callback, noAuto);
	}

	buddy.delete = function(url, parameters, callback, noAuto) {
		return _client.delete(url, parameters, callback, noAuto);
	}
	
	return buddy;
}();
