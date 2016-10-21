# CourierChat

![CourierChat Logo](https://cdn.rawgit.com/xcjs/courierchat/master/www/assets/images/courierchat.svg) CourierChat
============================================================================================================================

About
-----

CourierChat was created as a social chat room site with basic anonymity. Connections will be encrypted, messages will
not be kept once delivered (and will not even be stored in any long-term storage), and no tracking cookies beyond
session identifiers will be used.

Identities can be freely claimed and abandoned at any time.

Dependencies
------------

CourierChat is primarily written in Node.js, but requires a few root dependencies to get started:

* Node.js (of course)
* NPM
* Bower
* Grunt
* Sails.js
* Redis

All other dependencies can be tracked through the following files:

* ./packages.json (npm)
* ./bower.json (bower)

Setup instructions can be found in the provided Vagrantfile and should be enough to get you started under most Linux
distributions if you substitute the included commands for ones that work with your package manager. There should be no
reason why other operating systems could not execute CourierChat.

Startup
-------

If you wish to avoid managing these dependencies and the environment yourself, A Vagrantfile is provided with a
provisioning script.

Install Vagrant for your operating system, open a terminal in the CourierChat directory...

...and simply:

`vagrant up`

CourierChat will then be available in your web browser through http://localhost:1337 (the Sails devlepment server).
