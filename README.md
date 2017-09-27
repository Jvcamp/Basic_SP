# Instructions for SIMPLE SP

## PREREQUISITES
* **Required:** npm (https://www.npmjs.com/) - very easy to install ( next, next, finish)
* **For reference:** Main-module is Node js (saml2-js) https://www.npmjs.com/package/saml2-js


## GETTING STARTED
1. Copy files to desired location
1. Go to root folder, open powershell and type "npm install"
1. Aquire the required certificates (SSL,IDP,SP) and place them in the certificates folder
1. Update DNS entries (IDP and localhost)
1. Change configuration inside "<root>/configuration/<config_file>.json"
1. Go to root folder, open powershell and type "node server.js"

## TODO

- [x] Port settings to configuration file.
- [] Branch SAML2-JS module and commit changes.
- [] Include basic SSL and SP certificates.