var base_url = "https://sp.jorenhost.net";

function test(message) {
	alert(message);
}

function toggle() {
    var target = document.getElementById("raw_saml");
	var button = document.getElementById("toggle_raw_saml");
    if(target.style.display == 'block'){
        target.style.display = 'none';
		button.innerHTML = "Expand";
    }
    else {
        target.style.display = 'block';
		button.innerHTML = "Collapse";
    }
}

function saveElement(name,value){
	//alert(name+" : "+value)
	window.localStorage.setItem(name,value);
}


function authorize(){
	state = Math.floor((Math.random() * 1000000) + 1);
	saveElement('state',state);
	window.location.href = base_url+"/authorize?state="+state;
	//window.location.replace("http://stackoverflow.com");
}


function getToken(){
	var authz_code = window.localStorage.getItem("authz_code")
	window.location.href = base_url+"/gettoken?code="+authz_code;
	//window.location.replace("http://stackoverflow.com");
}
