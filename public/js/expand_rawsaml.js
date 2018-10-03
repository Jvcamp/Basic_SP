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
	alert(name+" : "+value)
	window.localStorage.setItem(name,value);
}

