	/*
	 * ===========================================================================================================================================================================
	 * ******************************************************************************    MODULES    ******************************************************************************
	 * ===========================================================================================================================================================================
	 */
	var saml2 = require('saml2-js');					// saml module
    var express = require('express'); 					// module for rendering webpages etc
	var app = express();								// create our app w/ express
    var morgan = require('morgan');            			// log requests to the console (express4)
    var bodyParser = require('body-parser');    		// pull information from HTML POST (express4)
	var fs = require('fs');								// required for reading from files
	var https = require('https');						// required for https service provider
	var jade = require('jade');							// EZ visualization
	var base64 = require('base-64');					// decode saml tokens for RAW_SAML
	var format = require('xml-formatter');				// required to properly format the 'raw_saml' xml strings.
	var request = require('request')
	
	/*
	 * ===========================================================================================================================================================================
	 * ***************************************************************************    CONFIGURATION    ***************************************************************************
	 * ===========================================================================================================================================================================
	 */
	 
	var config_filename = "vmswtest.json"
	//"fimlocal16test.json"
	
	try{
		var Configuration = JSON.parse(fs.readFileSync( __dirname+'/configuration/'+config_filename, 'utf8'));
	}catch (e){
		console.log("Problem loading configuration file '"+config_filename+"'");
		console.log(e)
		process.exit(1);
	}
	console.log("Loaded configuration file "+config_filename);
	// PS to change window title
	//$host.ui.RawUI.WindowTitle = "name"
	var xml_format_options = {indentation: '  ', stripComments: true};
	
	/*
	 * ===========================================================================================================================================================================
	 * ********************************************************************************    SSL    ********************************************************************************
	 * ===========================================================================================================================================================================
	 */
	var ssloptions = {
		key:  fs.readFileSync('certificates/SSL/'+Configuration.SSL_RSAkey),	// this needs to be unencrypted private key (rsa key)
		cert: fs.readFileSync('certificates/SSL/'+Configuration.SSL_PublicKey),
		ciphers: [
			"ECDHE-RSA-AES256-SHA384",
			"DHE-RSA-AES256-SHA384",
			"ECDHE-RSA-AES256-SHA256",
			"DHE-RSA-AES256-SHA256",
			"ECDHE-RSA-AES128-SHA256",
			"DHE-RSA-AES128-SHA256",
			"HIGH",
			"!aNULL",
			"!eNULL",
			"!EXPORT",
			"!DES",
			"!RC4",
			"!MD5",
			"!PSK",
			"!SRP",
			"!CAMELLIA"
		].join(':'),
		honorCipherOrder: true
	};
	
	
	
	/*
	 * ===========================================================================================================================================================================
	 * **************************************************************************    SERVICE PROVIDER    *************************************************************************
	 * ===========================================================================================================================================================================
	 */
	 
	//Generate the authentication context element to be used in the SP options.
	// we need the OR check here, because we can just omit the authentication context in that case, but if either one of the parameters is specified without the other, we need to include a default value for the other.
	if(Configuration.SP_authNcontext_comparison || Configuration.SP_authNcontext_classes){
		var authN_Context = {}
		if(Configuration.SP_authNcontext_comparison){
			authN_Context["comparison"] = Configuration.SP_authNcontext_comparison
		}else{
			authN_Context["comparison"] = "exact"
		}
		if(Configuration.SP_authNcontext_classes){
			authN_Context["class_refs"] = Configuration.SP_authNcontext_classes
		}else{
			//we need at least one authentication context class
			authN_Context["class_refs"] = ["urn:oasis:names:tc:SAML:1.0:am:password"]
		}
	}
	
	//Generate the SP options.
	var sp_options = {
		entity_id: Configuration.SP_entityID,
		private_key: fs.readFileSync(__dirname+"/certificates/localSP/"+Configuration.SP_certificatePrivateRsaKeyFile).toString(),
		certificate: fs.readFileSync(__dirname+"/certificates/localSP/"+Configuration.SP_certificatePublicKeyFile).toString(),
		assert_endpoint: "https://"+Configuration.App_URL+":"+Configuration.App_Port+"/assert",
		logout_endpoint: "https://"+Configuration.App_URL+":"+Configuration.App_Port+"/assertlogout",
		force_authn: Configuration.force_authn,
		auth_context: authN_Context,
		nameid_format: Configuration.SP_nameIdFormat,
		sign_get_request: Configuration.SP_sign_get_request,
		allow_unencrypted_assertion: Configuration.SP_allow_unencrypted_assertion
	}	
 
	  // Create ServiceProvider
	  var sp = new saml2.ServiceProvider(sp_options);

	  // Generate XML metadata for IDP to access. (Allow your app in firewall)
	  var spmetadata = sp.create_metadata();
	  fs.writeFile( __dirname+'/public/SP_metadata.xml', spmetadata, function (err){
	  	if (err) throw err;
	  	console.log('SP_metadata.xml saved');
	  }); 
	
/*
	 * ===========================================================================================================================================================================
	 * **************************************************************************    OAUTH    *************************************************************************
	 * ===========================================================================================================================================================================
	 */	
	var g_basicauth = base64.encode(Configuration.client_id+':'+Configuration.client_secret);
	
	/*
	 * ===========================================================================================================================================================================
	 * **************************************************************************    IDENTITY PROVIDER    ************************************************************************
	 * ===========================================================================================================================================================================
	 */
	 
	 
	 
	var idp_options = {
	  sso_login_url: Configuration.IDP_login_url,
	  sso_logout_url: Configuration.IDP_logout_url,
	  idp_initiated_signon_url: Configuration.IDP_initiated_signon_url,
	  // these certificates need to be of the '.cer' or '.pem' type
	  certificates: [
	  	fs.readFileSync("certificates/remoteIDP/"+Configuration.IDP_encryption_cert).toString(),		//encryption
		fs.readFileSync("certificates/remoteIDP/"+Configuration.IDP_signing_cert).toString()			//signing
	  ],
	  force_authn: true
	};
	
	//"Create" IdentityProvider
	var idp = new saml2.IdentityProvider(idp_options);
	
	//Generate app_baseUrl for linking to the correct location.
	var app_baseUrl = "https://"+Configuration.App_URL+":"+Configuration.App_Port
	

	/*
	 * ===========================================================================================================================================================================
	 * ****************************************************************************    APPLICATION    ****************************************************************************
	 * ===========================================================================================================================================================================
	 */	
	// Application configuration
    app.set('view engine','jade')									// specify jade as view engine
	app.set('views', __dirname+'/views')							// views are in root dir
	app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
    app.use(morgan('dev'));                                         // log every request to the console
    app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
    app.use(bodyParser.json());                                     // parse application/json
    app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json

	/*
	 * ===========================================================================================================================================================================
	 * ****************************************************************************    FUNCTIONS   ****************************************************************************
	 * ===========================================================================================================================================================================
	 */	
	function parseParameters(url){
		if(url.indexOf("?") !== -1){
		callbackResponse = url.split("?")[1];
		var responseParameters = (callbackResponse).split("&");
		var parameterMap = [];
		for(var i = 0; i < responseParameters.length; i++) {
			parameterMap[decodeURI(responseParameters[i].split("=")[0])] = decodeURI(responseParameters[i].split("=")[1]);
		}
		return parameterMap;
		}else{
			return "";
		}
	}
	
	function prettyPrint(json){
		try{
		const object = JSON.parse(json)
		console.dir(object, {depth: null, colors: true})
		}catch(err){
			console.log("Failed pretty print: "+json)
		}
	}
	/*
	 * ===========================================================================================================================================================================
	 * *****************************************************************************    ENDPOINTS    *****************************************************************************
	 * ===========================================================================================================================================================================
	 */
	
	// Endpoint to retrieve metadata 
	app.get("/metadata.xml", function(req, res) {
	  var file = __dirname + '/public/SP_metadata.xml';
	  res.download(file);
	});
	
	// Endpoint for proper visualization of the logoutresponse
	app.get("/logoutresponse.xml", function(req, res) {
	  var file = __dirname + '/public/LogoutResponse.xml';
	  res.download(file);
	});
	
	// Endpoint for proper visualization of the AuthNresponse
	app.get("/authnresponse.xml", function(req, res) {
	  var file = __dirname + '/public/AuthnResponse.xml';
	  res.download(file);
	});

	// Home endpoint
	app.get("/home", function(req, res) {
		var idp_login_url = idp_options.sso_login_url;
		res.render('home',{"app_baseUrl": app_baseUrl});
	});

	// Starting point for login 
	app.get("/login", function(req, res) {
	  sp.create_login_request_url(idp,{}, function(err, login_url, request_id) {
		if (err != null){
			return res.sendStatus(500);
			console.log(err);
		}
		console.log("Redirecting to IDP ("+login_url.slice(0,200)+"...)");
		var additional_parameters =""
		if(Configuration.additional_query_params != ""){
			additional_parameters = Configuration.additional_query_params
		}
		res.redirect(login_url+additional_parameters);
	  });
	});
	
	// Test point 
	app.get("/test", function(req, res) {
		
		res.send("This is a test point");
	});
	 	 
	// Assert endpoint for when logout completes 
	app.post("/assertlogout", function(req, res) {
		var options = {request_body: req.body};
		sp.post_assert(idp, options, function(err, saml_response) {
			raw_saml = format(base64.decode(req.body.SAMLResponse),xml_format_options);
			if (err != null){
			console.log(err);
			var json = err
			return res.render('error',{"app_baseUrl": app_baseUrl,"error":err,"raw_saml":raw_saml});			
		}
			fs.writeFile( __dirname+'/public/LogoutResponse.xml', raw_saml, function (err){
				if (err) throw err;
					console.log('LogoutResponse.xml saved');
			}); 
			res.render('logout', {"state":saml_response.state,"app_baseUrl": app_baseUrl,"IDP_init_signon":"test"});
		});
	});
	
	//-----------------------------------------------------------------------------------------------------------------------------------
	app.get("/oauth_callback.html", function(req, res) {
		var param = parseParameters(req.url);
		prettyPrint(param)
		console.log(param)
		fs.writeFile( __dirname+'/public/oauth.txt', JSON.stringify(param), function (err){
				if (err) throw err;
					console.log('oauth.txt saved');
			}); 
		res.render('oauth',param);
	});
	//-----------------------------------------------------------------------------------------------------------------------------------

	app.get("/callback", function(req, res) {
		var param = parseParameters(req.url);
		console.log(param)
		fs.writeFile( __dirname+'/public/oauth.txt', JSON.stringify(param), function (err){
				if (err) throw err;
					console.log('oauth.txt saved');
			}); 
		res.render('oauth',param);
	});
	
	// Assert endpoint for when login completes 
	app.post("/assert", function(req, res) {
	  var options = {request_body: req.body};
	  sp.post_assert(idp, options, function(err, saml_response) {
		raw_saml = format(base64.decode(req.body.SAMLResponse),xml_format_options);
		if (err != null){
			console.log(err);
			var json = err
			return res.render('error',{"app_baseUrl": app_baseUrl,"error":err,"raw_saml":raw_saml});			
		}
		// Save name_id and session_index for logout 
		// Note:  In practice these should be saved in the user session (cookie), not globally. 
		global.name_id = saml_response.user.name_id;
		global.session_index = saml_response.user.session_index;
		
		fs.writeFile( __dirname+'/public/AuthnResponse.xml', raw_saml, function (err){
			if (err) throw err;
			console.log('AuthnResponse.xml saved');
		}); 
		console.log("---------- Assert ----------");
		console.log("name id:        "+global.name_id);
		console.log("session index:  "+global.session_index);
		var attributes = '{"attributes":{ ' //LEAVE THE TRAILING SPACE
		var array = saml_response.user.attributes
		for (var key in array){
			var attrvalue = array[key].toString()//.replace("\\", "%");
			var fixname =key.replace(/http:\/\/[\w\.]*\/ws\/\d{4}\/\d{2}\/identity\/claims\//,"")
			attributes += '"';
			attributes += fixname;
			attributes += '" : "';
			attributes += attrvalue.replace("\\", "|");
			attributes += '",';
		}
		attributes =  attributes.slice(0,-1); //remove last ',' THIS IS WHY WE LEAVE THE TRAILING SPACE
		attributes += '},"session_index": "'+ global.session_index +'"}';
		//ORIG: attributes += '}}';
		var json = JSON.parse(attributes)
		json["app_baseUrl"] = app_baseUrl;
		res.set("session_index",global.session_index)
		res.render('assert',json)
		console.log("----------------------------");
	  });
	}); 
	 
	// Starting point for logout 
	app.get("/logout", function(req, res) {
		console.log("---------- Logout ----------");
		console.log("name id:        "+global.name_id);
		console.log("session index:  "+global.session_index);
	  var options = {
		name_id: global.name_id,
		session_index: global.session_index,
		sign_get_request: true	// this is required for ADFS, else: "MSIS7084: SAML logout request and logout response messages must be signed when using SAML HTTP Redirect or HTTP POST binding."
	  }; 
	  sp.create_logout_request_url(idp, options, function(err, logout_url) {
		  if (err != null){
			  return res.send(500);
		  }
		  res.redirect(logout_url);
		  console.log("logout url:     "+logout_url);
		  console.log("----------------------------");
	  });  
	});

	// endpoint to request authorization code.
    app.get("/authorize", function(req, res) {
	// test with eve http://eveonline-third-party-documentation.readthedocs.io/en/latest/sso/authentication.html#implementing-the-sso
	var param = parseParameters(req.url);
	console.log(param)
	let url = Configuration.authz_endpoint
	+"?client_id="+Configuration.client_id
	+"&response_type=code"
	+"&redirect_uri="+Configuration.callback_url
	+"&scope="+Configuration.scope
	+"&state="+param.state  				//required for requesting openid tokens
	;
	console.log("redirecting to: "+url)
	res.redirect(url);
  });
  
    //endpoint to change authZ code to access and refresh token.
    app.get("/gettoken", function(req, res) {
		let param = parseParameters(req.url)
		if(param.code != undefined){
			let config = {
				//host: Configuration.host,
				url: Configuration.token_endpoint,
				rejectUnauthorized: false,
				method:"POST",
				headers: {
						  'content-type': 'application/x-www-form-urlencoded'
						  //'authorization': "Basic "+g_basicauth
				},
				form: { 
					"code": param.code,
					"grant_type":"authorization_code",
					"client_id":Configuration.client_id,
					"scope":Configuration.scope,
					"redirect_uri":Configuration.callback_url
				}									
			};
			request.post(config,function(error,response,body) {
				if(error){
					console.log("ERROR: "+error)
				}
				prettyPrint(body)
				//console.log("token_response",body)
				res.render('assertoauth',{"body":body});
			});
		}
		
  });
	
	
	/*
	 * ===========================================================================================================================================================================
	 * *************************************************************************    APPLICATION START    *************************************************************************
	 * ===========================================================================================================================================================================
	 */
	//start app with 'node server.js'
	httpsServer = https.createServer(ssloptions,app).listen(Configuration.App_Port);
    console.log("App listening on port "+Configuration.App_Port);
