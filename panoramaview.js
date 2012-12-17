// TODO
// * LVM scene
// * POIs for lvm skene
// * arrow keys to move between POIs
// * nicer transitions

var isMobile = {
    Android: function() {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function() {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function() {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function() {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function() {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};

var XMLHttpFactories = [
    function () {return new XMLHttpRequest()},
    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
];

var camera, scene, renderer,
texture_placeholder, cube, isUserInteracting = false, previewReady = false,
onMouseDownMouseX = 0, onMouseDownMouseY = 0, initReady = 0, dragStartPoint,
lon = 0, onMouseDownLon = 0, size = 1024, segments = 17,
lat = 0, onMouseDownLat = 0, mapImage = new Image(), 
phi = 0, theta = 0, mesh, mapLoaded = false, mapElement, index = 0,
target = new THREE.Vector3(), materials = [], previewMaterials = [];

//var screenshot_server = 'http://studio.kyperjokki.fi:8886';
//var screenshot_server = 'http://192.168.100.47:8886';
//var screenshot_server = 'http://10.20.209.3:8886';

var screenshot_server = 'http://studio.kyperjokki.fi:8886'
var image_host = 'http://studio.kyperjokki.fi:8880/tundra/'

// positions are of the form [x, y, z, rotY, rotX] 
var positions = [[31, 46, 46, 13, -19],
                 [-159, 30, -67, -73, -11],
                 [21, 9.5,-166, 150, 0],
                 [126, 23, -135, 148, -16],
                 [151, 22, 24, 60, -13],
                ];
// the y-coordinate of the map is used to get the map image right
var mapCenter = [-2, 242, -28];
var mapTopRightCorner = [223, 200];

$(document).ready(init);

function init() {

    mapElement = $('#mapCanvas');

    for (var i = 0; i < 6; i++) {
        var texture = new THREE.Texture(texture_placeholder);
        var material = new THREE.MeshBasicMaterial({map: texture, overdraw: true});
        materials.push(material);
    }

    for (var i = 0; i < positions.length; i++) {
        previewMaterials.push([]);
    }

    var container = $('#container');
        
    if (isMobile.any()) {
	console('This is mobile');
        segments = 9;
        size = 512;
    } else {
	console.log('Probably this is desktop');
    }

    get_map();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);

    scene = new THREE.Scene();

    texture_placeholder = document.createElement('canvas');
    texture_placeholder.width = 128;
    texture_placeholder.height = 128;

    var context = texture_placeholder.getContext('2d');
    context.fillStyle = 'rgb(200, 200, 200)';
    context.fillRect(0, 0, texture_placeholder.width, texture_placeholder.height);

    cube = new THREE.Mesh(new THREE.CubeGeometry(300, 300, 300, segments, segments, segments, materials), new THREE.MeshFaceMaterial());

    cube.scale.x = - 1;
    scene.add(cube);

    console.log('Detecting...');
    var useWebgl = false

    if (Detector.webgl) {
    	useWebgl = true
    	console.log('Found webgl');
    } else {
    	console.log('Using canvas fallback');
    }
    
    if (useWebgl) {
    	renderer = new THREE.WebGLRenderer();
    } else {
    	renderer = new THREE.CanvasRenderer();
    }
    
    
    //wait some time before loading the images
    setTimeout(getPreviewImages, 3000);


    renderer.setSize(window.innerWidth, window.innerHeight);

    container.append(renderer.domElement);

    changePlace(positions[0][0], positions[0][1], positions[0][2], positions[0][3], positions[0][4]);

    container.hammer().bind("transform", onContainerTransform)
	.bind("dragstart", onContainerDragStart)
	.bind("drag", onContainderDrag);


    container.mousedown(onDocumentMouseDown);
    container.mousemove(onDocumentMouseMove);
    container.mouseup(onDocumentMouseUp);

    container.bind('mousewheel', onDocumentMouseWheel);

    $(document).keyup(onDocumentKeyUp);

    mapElement.click(onMapClick);

    window.addEventListener('resize', onWindowResize, false);

}

function d(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function onContainerTransform(evt) {
    var scale = evt.scale;

    if (scale > 1.0) {
        camera.fov -= (scale - 1) * 5;
    }
    
    if (scale < 1.0) {
        camera.fov += (1 - scale) * 20;
    }

    camera.fov = Math.min(75, camera.fov);
    camera.fov = Math.max(15, camera.fov);

    camera.updateProjectionMatrix();

    render();
}

function onMapClick(event) {
    event.preventDefault();

    if (!event)
	event = window.event;
    
    //IE9 & Other Browsers
    if (event.stopPropagation) {
	event.stopPropagation();
    }
    //IE8 and Lower
    else {
	event.cancelBubble = true;
    }
    
    var mx = event.pageX - (window.innerWidth - 205);
    var my = event.pageY - 5;
    var hitIndex = null;
    for (var i = 0; i < positions.length; i++) {
    	var pos = positions[i];
    	var p = world2map(new THREE.Vector2(pos[0], pos[2]));
	if (d(mx, my, p.x, p.y) <= 5) {
	    hitIndex = i;
	}
    }
    if (hitIndex !== null) {
	index = hitIndex;
	var p = positions[index];
	changePlace(p[0], p[1], p[2], p[3], p[4]);
    }
}

function world2map(wCoords) {
    mCoords = new THREE.Vector2();
    
    var ax = (mapElement.width / 2) / (mapCenter[0] - mapTopRightCorner[0]);
    var bx = -mapTopRightCorner[0] * ax;
    
    var ay = (mapElement.height / 2) / (mapCenter[2] - mapTopRightCorner[1]);
    var by = -mapTopRightCorner[1] * ay;

    mCoords.x = ax * wCoords.x + bx;
    mCoords.y = ay * wCoords.y + by;

    return mCoords;
}

function get_map() {
    var map_uri = screenshot_server + "/renderimg?posX=" + mapCenter[0] + "&posY=" + mapCenter[1] + "&posZ=" + mapCenter[2] + "&ortX=0&ortY=0.7071067811865476&ortZ=0.7071067811865476&ortW=0"
    console.log("loading <a href=\"" + map_uri + "\">map</a>");

    //use indirect loading
    sendRequest(map_uri, function(req) {
        var mapurl = req.responseText;
        console.log("map url: " + req + " - " + mapurl);
	map_img = new Image();
	map_img.onload = function() {
	    console.log('Map loaded');
	    mapImage = map_img;
	    mapLoaded = true;
	}
        map_img.src = mapurl;
    });
}

function drawMap(x, y, angle) {
    var v = world2map(new THREE.Vector2(x, y));
    var x = v.x;
    var y = v.y;

    //x, y is the center point on map coortinates
    //angle is the way we roll
    var canvas = document.getElementById('mapCanvas');
    var ctx = canvas.getContext('2d');

    //draw map
    if (mapLoaded) {
	ctx.drawImage(mapImage, 0, 0, mapElement.width, mapElement.height);
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.translate(-x, -y);
    //draw arrow
    ctx.beginPath();
    //stem
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y + 20);
    //left thiungy
    ctx.moveTo(x - 5, y - 15);
    ctx.lineTo(x, y - 20);
    //right thungy
    ctx.moveTo(x + 5, y - 15);
    ctx.lineTo(x, y - 20);

    ctx.restore();

    //circles
    for (var i = 0; i < positions.length; i++) {
    	var pos = positions[i];
    	var p = world2map(new THREE.Vector2(pos[0], pos[2]));
	ctx.moveTo(p.x + 5, p.y);
    	ctx.arc(p.x, p.y, 5, 0, Math.PI * 2, true); 
    }

    ctx.stroke();
    ctx.closePath();

}

function loadMaterials(baseUrl) {
    console.log('Loading materials from ' + baseUrl);
    var fileNames = ['nx.png', 'px.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']
    for (var i in fileNames) {
	cube.geometry.materials[i] = loadTexture(baseUrl + fileNames[i], i)
    }
}


function getPreviewImages() {
    var url = screenshot_server + '/preview?';
    for (var i = 0; i < positions.length; i++) {
        var pos = positions[i];
        url += 'p' + i + '=' + pos[0] + ',' + pos[1] + ',' + pos[2];
        if (i < positions.length - 1) {
            url += '&';
        }
    }
    console.log('getting preview images from', url);
    sendRequest(url, function(req) {
        previewReady = true;
        console.log('preview images are ready');
        var fileNames = ['nx.png', 'px.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']
        for (var i = 0; i < positions.length; i++) {
            for (var j in fileNames) {
                var pos = positions[i][0] + ',' + positions[i][1] + ',' + positions[i][2]
	        previewMaterials[i][j] = loadTexture(image_host + pos + '/' + fileNames[j]);
            }
        }       
    });
}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    render();
}

function loadTexture(path, idx) {

    if (idx === undefined) {
        var texture = new THREE.Texture(texture_placeholder);
        var material = new THREE.MeshBasicMaterial({ map: texture, overdraw: true });
    } else {
        material = cube.geometry.materials[idx];
        texture = material.map;
    }
    
    var image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = function () {
        texture.needsUpdate = true;
        material.map.image = this;
        if (initReady <= 6) {
            initReady++
        }
        render();

    };
    image.src = path;

    return material;
}

function changePlace(x, y, z, rotY, rotX) {
    console.log('Change place', x, y, z, rotY);   
    url = screenshot_server + "/cubeimg?posX=" + x + "&posY=" + y + "&posZ=" + z;
    url += '&res=' + size;

    // FIXME 180 is for Secret O scene
    lon = 180 - rotY;
    lat = rotX;
    
    // reset zoom
    camera.fov = 75;
    camera.updateProjectionMatrix();

    if (previewReady) {
        console.log('Preview images are ready');
        var ready = true
        if (previewMaterials[index].length == 6) {
            for (var i = 0; i < 6; i++) {
                if (previewMaterials[index][i] === undefined) {
                    ready = false;
                }
            }
        }
        
        if (ready) {
            console.log("Got all preview materials");
            for (i = 0; i < 6; i++) {
                cube.geometry.materials[i] = previewMaterials[index][i];
            }
        } else {
            var previewUrl = image_host + x + ',' + y + ',' + z + '/'
            console.log('using non-loaded images from', previewUrl);
            loadMaterials(previewUrl);
        }
    } 
    
    sendRequest(url, function(req) {
	var imageBaseUrl = req.responseText;
	console.log('loading from ' + imageBaseUrl);
	loadMaterials(imageBaseUrl);
    });
    
    render();
}

function onDocumentKeyUp(event) {
    if (event.keyCode == 78) {
	index = (index + 1) % positions.length;
	var p = positions[index]
	changePlace(p[0], p[1], p[2], p[3], p[4]);
    }
}

function onDocumentMouseDown(event) {
    event.preventDefault();

    isUserInteracting = true;

    onPointerDownPointerX = event.clientX;
    onPointerDownPointerY = event.clientY;

    onPointerDownLon = lon;
    onPointerDownLat = lat;

}

function onDocumentMouseMove(event) {

    if (isUserInteracting) {

        lon = (onPointerDownPointerX - event.clientX) * 0.1 + onPointerDownLon;
        lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
        render();

    }

}

function onDocumentMouseUp(event) {

    isUserInteracting = false;
    render();

}

function onDocumentMouseWheel(event) {

    camera.fov -= event.wheelDeltaY * 0.05;

    camera.fov = Math.min(75, camera.fov);
    camera.fov = Math.max(15, camera.fov);

    camera.updateProjectionMatrix();

    render();

}


function onDocumentTouchStart(event) {

    if (event.touches.length == 1) {

        event.preventDefault();

        onPointerDownPointerX = event.touches[ 0 ].pageX;
        onPointerDownPointerY = event.touches[ 0 ].pageY;

        onPointerDownLon = lon;
        onPointerDownLat = lat;

    }

}

function onDocumentTouchMove(event) {

    if (event.touches.length == 1) {

        event.preventDefault();

        lon = (onPointerDownPointerX - event.touches[0].pageX) * 0.1 + onPointerDownLon;
        lat = (event.touches[0].pageY - onPointerDownPointerY) * 0.1 + onPointerDownLat;

        render();

    }
}

function onContainerDragStart(event) {
    dragStartPoint = event.position
    onPointerDownLon = lon;
    onPointerDownLat = lat;

}

function onContainderDrag(event) {
    lon = (dragStartPoint.x - event.position.x) * 0.1 + onPointerDownLon;
    lat = (event.position.y - dragStartPoint.y) * 0.1 + onPointerDownLat;

    render();

}

function render() {

    //hide the loading when ready
    if (initReady >= 6) {
	$('#loading').fadeOut(500);
        //seven is magic (not really)
        initReady = 7
    }


    lat = Math.max(- 85, Math.min(85, lat));
    phi = (90 - lat) * Math.PI / 180;
    theta = lon * Math.PI / 180;

    target.x = 500 * Math.sin(phi) * Math.cos(theta);
    target.y = 500 * Math.cos(phi);
    target.z = 500 * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(target);

    renderer.render(scene, camera);
    
    drawMap(positions[index][0], positions[index][2], theta);

}

//from http://www.quirksmode.org/js/xmlhttp.html
function sendRequest(url,callback,postData) {
    var req = createXMLHTTPObject();
    if (!req) return;
    var method = (postData) ? "POST" : "GET";
    req.open(method,url,true);
    //req.setRequestHeader('User-Agent','XMLHTTP/1.0');
    if (postData)
	req.setRequestHeader('Content-type','application/x-www-form-urlencoded');
    req.onreadystatechange = function () {
	if (req.readyState != 4) return;
	if (req.status != 200 && req.status != 304) {
	    //alert('HTTP error ' + req.status);
            console.log('ERROR: ' + url + ", " + req.status);
	    return;
	}
	callback(req);
    }
    if (req.readyState == 4) return;
    req.send(postData);
}

function createXMLHTTPObject() {
    var xmlhttp = false;
    for (var i=0;i<XMLHttpFactories.length;i++) {
	try {
	    xmlhttp = XMLHttpFactories[i]();
	}
	catch (e) {
	    continue;
	}
	break;
    }
    return xmlhttp;
}
