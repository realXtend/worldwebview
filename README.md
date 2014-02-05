There is no live demo for this currently, sorry. Hopefully we'll get one up soon again!

Installation instructions
=========================

HTTP Rendering server
---------------------

Current default backend is realXtend Tundra 2.

To use with that, you need Tundra with Python support (default on
Linux, requires working with an own build on Mac and Windows
currently).

Pull the feature branch from: https://github.com/therauli/tundra/blob/httpserver/

(it includes a little Quat setting py api support func in c++ so
recompile is needed it also has a "custom" screencapturing function
used in panorama viewer -- otherwise is just two py files that only
depend on the py stdlib)

For server config, copy the template file:
https://github.com/therauli/tundra/blob/httpserver/bin/pyplugins/httpserver/config.py.template

.. to config.py in the same dir, and edit the img url and path (how
exactly is explain below in 'web server for images')

That branch has the server plugin enabled by default, in plugins.xml, which is always loaded:

    <pyplugin path="httpserver/tundrahttphandler.py" />  <!-- to create image frames, render server -->

If you want to enable the server only conditionally (for example for
servers only and not for clients too), put that line to a different
tundra plugin xml (e.g. a separate httpserver.xml one -- you can load
many from the cmdline at startup).

The web clients
--------------

WorldWebViewer
______________

Get a copy of worldwebview.html from here, for example by cloning this repository.

To avoid cross-site scripting security sandbox trouble, that html with
the client code is delivered from the rendering server's (tundra2)
http server. By default, the Tundra http handler expects to find
'worldwebview.html' in ../../worldwebview/.

So to make the default config work, just have your Tundra git clone
and WorldWebView git clone side by side in the same directory. (so
from tundra/bin/, ../../worldwebview/ is found). Or just edit the py
server on this line and load the html from where you want: clienthtml
= open("../../worldwebview/worldwebview.html")

By default, the web client connects to a local tundra server:
(in https://github.com/realXtend/worldwebview/blob/master/worldwebview.html#L24)

    var screenshot_server = "http://127.0.0.1:8886/renderimg";

Change that to your public Internet address to make it work on the net.

WorldPanoramaViewer
___________________

Get a copy of worldpanoramaview.html and three.js r52 should work you
can get three.js from http://mrdoob.github.com/three.js/)

By default the web client will try connect some test server in a local
network :) Change the line https://github.com/realXtend/worldwebview/blob/master/worldpanoramaview.html#L69 to your servers address (unlike in worldwebview don't add the renderimg/ or anything)

Web server for images
---------------------

The images are not transferred from Tundra's http server, not from
Tundra's process at all, but with a separate http server. This is to
minimize the load on Tundra, and allow for normal production quality
web server use and scalability tricks for the image transfers.

So you must have a web server for static files available. The HTTP
render handlers in the Tundra plugin copies / moves the images taken
to there. The resulting baseurl for the images, and the directory
where they are on the server, are configured in the config.py that you
should create based on the config.py.template

The defaults in the template are on unix-like systems where
e.g. apache is serving /var/www/ .

If you want to use a separate machine as the web server, you need some
way to get the pics over there, and make the http handling py code do
that.

Other backends
==============

Tundra 0.x - 1.x
----------------

This client was originally developed against Naali 0.x, which became
Tundra 1.x, where the http serving counterpart was bundled by
default. But AFAIK no one uses Tundra 1 anymore so that is not
documented here now.

Opensimulator with Warp3D software rendering
--------------------------------------------

Back 1-2 years ago I also added server side rendering support with
http controls to Opensimulator, and Nebadon and Melanie tested using
this same web client to their Opensim servers. It worked ok and was
sure fun enough, but the Warp3D SW rendering module there had severe
memory leaks (was originally made for one-time map rendering, not many
subsequent calls like with this) -- I didn't go into fixing those. If
someone is interested, is still well possible to use this there too
(and the mem leak in the rendering seemed ease to fix with some
restructuring of the code).

Do get in touch if you wish to use this against Opensimulator or some
other backend! The more the merrier, and the http API is simple to
implement and have compatible (the server just needs to answer http
gets with cam coords as args, and return the url to the resulting
image). Wonderland, Sirikata -- interested?
