# Instructions for SIMPLE SP

## PREREQUISITES
* **Required:** npm (https://www.npmjs.com/) - very easy to install ( next, next, finish)
* **For reference:** Main-module is Node js (saml2-js) https://www.npmjs.com/package/saml2-js


## GETTING STARTED
1. Copy files to desired location
1. Go to root folder, open powershell and type **npm install**
1. Aquire the required certificates (SSL,IDP,SP) and place them in the certificates folder
1. Update DNS entries (IDP and localhost)
1. Change configuration inside _<root>/configuration/<config_file>.json_
1. Update the _config_filename_ parameter at the top of the _server.js_ file to point to the correct configuration file. (ex: **var config_filename = _example-config.json_**")
1. Go to root folder, open powershell and type **node server.js**

## TODO

- [x] Port settings to configuration file.
- [x] Include Port support for URL's
- [x] Move hostname to app parameters.
- [ ] Include signing algorithm and logout response url in metadata
- [ ] Branch SAML2-JS module and commit changes.
- [ ] Include basic SSL and SP certificates.
- [ ] Research possibility for multiple IDP's.