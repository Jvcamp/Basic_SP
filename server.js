	
	//Required modules
	var saml2 = require('saml2-js');					// saml module
    var express = require('express'); 					// module for rendering webpages etc
	var app = express();								// create our app w/ express
    var morgan = require('morgan');            			// log requests to the console (express4)
    var bodyParser = require('body-parser');    		// pull information from HTML POST (express4)
    var methodOverride = require('method-override'); 	// simulate DELETE and PUT (express4)
	var fs = require('fs');								// required for reading from files
	var https = require('https');						// required for https service provider
	var jade = require('jade');							// EZ visualization
	var base64 = require('base-64');					// decode saml tokens for RAW_SAML
	
	
	
	
	// SSL Configuration
	// --------------------------------------------------------------------------------------------------------------------------  Specify certificates here
	
	// SSL-communications Configuration
	// this needs to be unenctrypted private key (rsa key)
	var sslkey = fs.readFileSync('certificates\\SSL\\commkey.key');
	var sslcert = fs.readFileSync('certificates\\SSL\\commcert.crt');
	
	var ssloptions = {
		key: sslkey,
		cert: sslcert,
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
	
	// SP Configuration
	var sp_private = fs.readFileSync("certificates\\localSP\\sp.key").toString(); // this needs to be KEY or the assertion can't be decrypted properly (.PEM does not work)
	var sp_public = fs.readFileSync("certificates\\localSP\\sp.crt").toString();
	
	//IDP configuration
	// these certificates need to be of the '.cer' or '.pem' type
	
	//Jorenlab
	var idp_enc_cert = fs.readFileSync("certificates\\remoteIDP\\jorenlab_enc.cer").toString();
	var idp_sign_cert = fs.readFileSync("certificates\\remoteIDP\\jorenlab_sign.cer").toString();
	//*/
	
	
	
	
	// APP configuration
    app.set('view engine','jade')									// specify jade as view engine
	app.set('views', __dirname+'/views')										// views are in root dir
	app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
    app.use(morgan('dev'));                                         // log every request to the console
    app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
    app.use(bodyParser.json());                                     // parse application/json
    app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
    app.use(methodOverride());
	// this is for "Access-Control-Allow-Origin"
	/*app.use(function(req, res, next) {
		res.header('Access-Control-Allow-Origin', "*");
		res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
		res.header('Access-Control-Allow-Headers', 'Content-Type');
		next();
	})*/

	
	
	
	
	// Service provider
	// --------------------------------------------------------------------------------------------------------------------------  Specify SP options here
	var sp_options = {
		entity_id: "https://sp.jorenhost.net/jorenSPidentifier",
		private_key: sp_private,  
		certificate: sp_public,
		assert_endpoint: "https://sp.jorenhost.net/assert",
		logout_endpoint: "https://sp.jorenhost.net/assertlogout",
		force_authn: false,
		auth_context: { comparison: "exact", class_refs: ["urn:oasis:names:tc:SAML:1.0:am:password"] },
		nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
		sign_get_request: false,
		allow_unencrypted_assertion: true
	}	
 
	  // Call service provider constructor with options 
	  var sp = new saml2.ServiceProvider(sp_options);
	 
	  // Example use of service provider. 
	  // Call metadata to get XML metatadata used in configuration. 
	  var spmetadata = sp.create_metadata();
	
	
	// IdentityProvider
	// --------------------------------------------------------------------------------------------------------------------------  Specify IDP options here
	var idp_options = {
	  //This is JorenLAB
	  sso_login_url: "https://adfs16.fim.local/adfs/ls/trust",
	  sso_logout_url: "https://adfs16.fim.local/adfs/ls/trust",
	  certificates: [idp_enc_cert,idp_sign_cert]
	  //*/
	};
	
	var idp = new saml2.IdentityProvider(idp_options);

	
	
	
	// Site endpoints
	// --------------------------------------------------------------------------------------------------------------------------  Specify site endpoints here
	
	// Endpoint to retrieve metadata 
	app.get("/metadata.xml", function(req, res) {
	  res.type('application/xml');
	  res.send(spmetadata);
	});

	// Home endpoint
	app.get("/home", function(req, res) {
		var idp_login_url = idp_options.sso_login_url;
		var attributes = '{"login_url":"';
		attributes += idp_login_url;
		attributes += '"}';
		var json = JSON.parse(attributes);
		res.render('home',json);
	});
	
	// Starting point for login 
	app.get("/login", function(req, res) {
	  sp.create_login_request_url(idp, {}, function(err, login_url, request_id) {
		if (err != null){
			return res.sendStatus(500);
			console.log(err);
		}
		res.redirect(login_url);
	  });
	});
	 	 
	// Assert endpoint for when logout completes 
	app.post("/assertlogout", function(req, res) {
	  var options = {request_body: req.body};
	  sp.post_assert(idp, options, function(err, saml_response) {
		if (err != null){
		  console.log(err);
		  // catch 'SAML Response was not success!'
		  return res.send(err);
		}
		raw_saml = base64.decode(req.body.SAMLResponse)
		res.render('logout', {"state":saml_response.state});
	  });
	});

	// Assert endpoint for when login completes 
	app.post("/assert", function(req, res) {
	  var options = {request_body: req.body};
	  sp.post_assert(idp, options, function(err, saml_response) {
		if (err != null){
			console.log(err);
			return res.send(err);			
		}
		// Save name_id and session_index for logout 
		// Note:  In practice these should be saved in the user session, not globally. 
		global.name_id = saml_response.user.name_id;
		global.session_index = saml_response.user.session_index;
		raw_saml = base64.decode(req.body.SAMLResponse)
		console.log("----- Assert -----");
		console.log("name id:        "+global.name_id);
		console.log("session index:  "+global.session_index);
		var attributes = '{"attributes":{'
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
		attributes =  attributes.slice(0,-1); //remove last ','
		attributes += '}}';
		var json = JSON.parse(attributes)
		res.render('assert',json)
	  });
	}); 
	 
	// Starting point for logout 
	app.get("/logout", function(req, res) {
		console.log("----- Logout -----");
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
	  });
	});

	
	
	
	//start app with 'node server.js'
	httpsServer = https.createServer(ssloptions,app).listen(443);
    console.log("App listening on port 443");
