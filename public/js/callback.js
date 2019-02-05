var secureURL = "https://sp.jorenhost.net/assert";
var loginURL = "https://sp.jorenhost.net/home";
var messageset = false;


var callbackResponse = null;
if((document.URL).indexOf("#") != -1){
	alert(document.URL);
	callbackResponse = (document.URL).split("#")[1];
}
if((document.URL).indexOf("?") != -1){
	callbackResponse = (document.URL).split("?")[1];
}
var responseParameters = (callbackResponse).split("&");
var parameterMap = [];
for(var i = 0; i < responseParameters.length; i++) {
    parameterMap[responseParameters[i].split("=")[0]] = responseParameters[i].split("=")[1];
}

checkError();

if(parameterMap.code !== undefined && parameterMap.code !== null){
	//We have a code, now we need to change it for an ACCESS TOKEN.
	handle_authz_code();
}
if(parameterMap.access_token !== undefined && parameterMap.access_token !== null) {
		//we have an access token
		handle_token("Access Token");
}else{
	if(parameterMap.id_token !== undefined && parameterMap.id_token !== null) {
		handle_token("ID Token");
	}else{
		if(messageset){
				//message is already set
		}else{
		window.localStorage.setItem("message","No authZ code, access or ID token found");
		}
	}
}

function checkError(){
	if(parameterMap.error_description){
		alert(parameterMap.error_description.replace(/\+/g," "));
	}
}

function checkState(){
	if(parameterMap.state){
		var savedstate = window.localStorage.getItem("state");
		if(parameterMap.state != savedstate){
			alert("STATE IS NOT CONSISTENT    sent:"+parameterMap.state+"     saved:"+savedstate);
		}
	}
}
function handle_authz_code(){
	checkState();
	var authz_code = { code : parameterMap.code }
	window.localStorage.setItem("message","Authorization code acquired!");
	messageset = true;
	window.localStorage.setItem("authz_code",parameterMap.code);
	window.location.href = loginURL;
}


function handle_token(token_type){
		// i dont know if this will work, not all items are present
		var token = {
			access_token: parameterMap.access_token,
			refresh_token: parameterMap.refresh_token,
			scope: parameterMap.scope,
			expires_in: parameterMap.expires_in,
			account_username: parameterMap.account_username,
			name: token_type,
			id_token: parameterMap.id_token
		};
		window.localStorage.setItem("token", JSON.stringify(token));
		window.localStorage.setItem("message","Handled "+token_type+".");
		messageset = true;
		window.location.href = secureURL;
}
