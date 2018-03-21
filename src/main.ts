import {vec3, vec4, mat4} from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import Square from './geometry/Square';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import Particle from './particle';
import { transformMat4 } from 'gl-vec4';
import Mesh from './geometry/Mesh';
import * as fs from 'fs';


var OBJ = require('webgl-obj-loader');


let mesh: Mesh;

 //https://stackoverflow.com/questions/14446447/how-to-read-a-local-text-file
 function readTextFile(file: string) : string
 {
     var text = "";
     var rawFile = new XMLHttpRequest();
     rawFile.open("GET", file, false);
     rawFile.onreadystatechange = function ()
     {
         if(rawFile.readyState === 4)
         {
             if(rawFile.status === 200 || rawFile.status == 0)
             {
                 var allText = rawFile.responseText;
                 text = allText;
             }
         }
     }
     rawFile.send(null);
     return text;
 }

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
  tesselations: 5,
  'Load Scene': loadScene, // A function pointer, essentially
  mesh: 0,
};

let square: Square;
let time: number = 0.0;
let particles: Array<Particle>;
let offsetsArray: Array<number>;
let colorsArray: Array<number>;
let n: number;

let mouseDownX: number;
let mouseDownY: number;
let mouseUpX: number;
let mouseUpY: number;

let attractParticles: boolean = true;
let repelParticles: boolean = false;
let meshAttract: boolean = true;

let mouseClickWorldLocation: vec3 = vec3.fromValues(0, 0, 0);

let bounds: number;

let camera = new Camera(vec3.fromValues(50, 50, 10), vec3.fromValues(50, 50, 0));

let rayCastDebug: Square;


function cosColor(t: number) : vec3
{
  // vector parameters for color cosine curve, red -> pink -> purple
  var a = vec3.fromValues(.821, .328, .242);
  var b = vec3.fromValues(.268, -2.92, .896);
  var c = vec3.fromValues(.768, 1.078, .296);
  var d = vec3.fromValues(2.820, 3.026, -0.273);

  var scale = vec3.create();
  var addCTD = vec3.create();
  var scale2Pi = vec3.create();
  vec3.scale(scale, c, t);
  vec3.add(addCTD, scale, d);
  vec3.scale(scale2Pi, addCTD, 6.28318);
  var cosVec = vec3.fromValues(Math.cos(scale2Pi[0]), Math.cos(scale2Pi[1]), Math.cos(scale2Pi[2]));
  var bCos = vec3.create();
  vec3.mul(bCos, b, cosVec);
  var toReturn = vec3.create();
  vec3.add(toReturn, a, bCos);
  return toReturn;
}

function setUpParticles()
{

  mesh = new Mesh(vec3.fromValues(0,0,0));
  mesh.loadBuffers(readTextFile('src/objs/cube.obj'));
  mesh.create();

  bounds = 15;
  particles = new Array<Particle>();
  square = new Square();
  square.create();

  rayCastDebug = new Square();
  rayCastDebug.create();

  // Set up particles here. Hard-coded example data for now
  offsetsArray = [];
  colorsArray = [];
  n = 100.0;
  var id = 0;
  
  for(let i = 0; i < n; i++) {
    for(let j = 0; j < n; j++) {

        var cX = i;
        var cY = j;
        var cZ = Math.random() * 2;

        var pX = cX;
        var pY = cY;
        var pZ = cZ;
  

      // var position = vec3.fromValues(i, j, 0);
        var position = vec3.fromValues(cX, cY, cZ);
        var prevPos = vec3.fromValues(pX, pY, pZ);
        var velocity = vec3.fromValues(0, 0, 0);
        var acceleration = vec3.fromValues(0, 0, 0);
        var offset = vec3.fromValues(i, j, 0);

        var t = vec3.dist(position, vec3.fromValues(0,0,0)); // color takes distance from origin as input for time being. In future, update this to be distance from attractor/repellor force, i.e. mouseclick (x,y)
        var vec3color = cosColor(t);
        var color = vec4.fromValues(Math.max(0, vec3color[0]), Math.max(0, vec3color[1]), Math.max(0, vec3color[2]), 1.0);
        var currParticle = new Particle(position, velocity, acceleration, offset, color, id);
        currParticle.prevPos = prevPos;
        currParticle.bounds = bounds;
        particles.push(currParticle);

        offsetsArray.push(cX);
        offsetsArray.push(cY);
        offsetsArray.push(cZ);

        colorsArray.push(color[0]);
        colorsArray.push(color[1]);
        colorsArray.push(color[2]);
        colorsArray.push(.2); // Alpha channel
        id++;
    }
  }
}

function loadScene() {
  setUpParticles();
}

function main() {
  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  // Add controls to the gui
  const gui = new DAT.GUI();

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement> document.getElementById('canvas');
  const gl = <WebGL2RenderingContext> canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene
  loadScene();

 

  const renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0.2, 0.2, 0.2, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // Additive blending

  const lambert = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/particle-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/particle-frag.glsl')),
  ]);
  


  function raycast() : vec3
  {
    if(isNaN(mouseDownX) || isNaN(mouseDownY))
    {
      return vec3.fromValues(0, 0, 0);
    }
    
    // raycast mouseDownX and mouseDownY to a worldspace vec3
    // 1) convert to NDC
    var sx = (2.0 * mouseDownX/window.innerWidth) - 1.0;
    var sy = 1.0 - (2.0 * mouseDownY/window.innerHeight);
    console.log(sx, sy);

    // 2) screen point to world point

    // len = |ref - eye|
    var refminuseye = vec3.create();
    //vec3.add(refminuseye, camera.position, camera.target);
    vec3.subtract(refminuseye, camera.position, camera.target);
    var len = vec3.length(refminuseye);
   
    // V = U*len*tan(alpha)
    var alpha = camera.fovy / 2.0;
    var V = vec3.create();
    vec3.scale(V, camera.up, len*Math.tan(alpha));
   
    // H = R*len*aspec*tan(alpha)
    var H = vec3.create();
    vec3.scale(H, camera.right, len*camera.aspectRatio*Math.tan(alpha));
  
    // p = ref + sx*H +sy*V
    var p = vec3.create();
    var sxH = vec3.create();
    var syV = vec3.create();
    vec3.scale(sxH, H, sx);
    vec3.scale(syV, V, sy);
    vec3.add(p, syV, sxH);
    vec3.add(p, p, camera.target);

    return p;
  }

  function remap(low2: number, high2: number, low1: number, high1 : number, value :number)
  {
    return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
  }

  // referenced http://natureofcode.com/book/chapter-2-forces/
  function calculateForce(p : Particle, i : number) : vec3
  {
    // calculate direction (mousePos - particlePos)
    var offset = vec3.fromValues(0, 0, 0);
    if(mouseClickWorldLocation == null) mouseClickWorldLocation = vec3.fromValues(0,0,0);

    var pointOfInterest = vec3.create();
    var mouseOffset = vec3.fromValues(Math.random(), Math.random(), Math.random());

    // if i != -1, mesh attraction
    if(i != -1)
    {
      //debugger;
      var meshAttractorLocation = vec3.create();
      var meshVerts = mesh.positions;
      if(i * 4 > meshVerts.length) 
      {
        // remap i to be in valid range
        i = Math.floor(remap(0, meshVerts.length, 0, particles.length, i));
      }
      meshAttractorLocation = vec3.fromValues(meshVerts[i * 4] * 5, meshVerts[i * 4 + 1] * 5, meshVerts[i * 4 + 2] * 5);
      mouseOffset = vec3.fromValues(0, 0, 0);
      vec3.scaleAndAdd(pointOfInterest, meshAttractorLocation, mouseOffset, .01 * bounds);
    } else {
      
      vec3.normalize(mouseOffset, mouseOffset);
      vec3.scaleAndAdd(pointOfInterest, mouseClickWorldLocation, mouseOffset, .01 * bounds);
    }

    vec3.subtract(offset, pointOfInterest, p.currPos);
    //var particleOffset

    /*
    - Offset = currPos - attractor
    - distance = length of offset
    - if distance < epsilon, offset = random small direction
    - distance = length(random small direction)
    direction = normalize(offset)
    */
    var distance = vec3.length(offset);
    if(distance < 1e-4)
    {
      offset = vec3.fromValues(Math.random() * .01, Math.random() * .01, Math.random() * .01);
      distance = vec3.length(offset);
    }

    if (distance < bounds) {
      distance = bounds;
    }
    
    const farThreshold = 20;
    if (distance > farThreshold)
    {
      distance = farThreshold; // tune this value, but keeps it from getting too far away
    }

    var direction = vec3.fromValues(0, 0, 0);
    vec3.normalize(direction, offset);

    var G = .05;
    var scaleMass2 = 3;
    if(attractParticles)
    {
      G = .1;
      scaleMass2 = 100;
    }

    if(meshAttract)
    {
      scaleMass2 = 100;
    }
    
    var mass1 = p.mass;
    var mass2 = scaleMass2 * mass1; // arbitrarily setting mass of attractor to be 2 times that of a particle

    //console.log(distance);
    var m = (G * mass1 * mass2) / (distance * distance );
    var dir = vec3.fromValues(0, 0, 0);

    if(attractParticles)
    {    
      // if particle is at edge of bounding box, reverse direction of acceleration
      if(distance < bounds)
      {
        //vec3.scale(dir, direction, -m);
      } else {
        vec3.scale(dir, direction, m);
      }

    } else if (repelParticles)
    {
      // if particle is at edge of bounding box, reverse direction of acceleration
      if(distance > bounds)
      {
        //vec3.scale(dir, direction, -m);
      } else {
        vec3.scale(dir, direction, -m);
      }
    }

    return dir;
  }

  // This function will be called every frame
  function tick() {
    camera.update();
    stats.begin();

    var oldTime = time;
    lambert.setTime(time += 10);
    var dt = time - oldTime;

    let offsets: Float32Array = new Float32Array(offsetsArray);
    let colors: Float32Array = new Float32Array(colorsArray);
    square.setInstanceVBOs(offsets, colors);
    square.setNumInstances(n * n); // 10x10 grid of "particles"

    var mouseclickOffset = new Float32Array([mouseClickWorldLocation[0], mouseClickWorldLocation[1], mouseClickWorldLocation[2]]);
    var mouseclickColor = new Float32Array([0, 0, 1, 1]);
    rayCastDebug.setInstanceVBOs(mouseclickOffset, mouseclickColor);
    rayCastDebug.setNumInstances(1);

    // update the positions of all the particles
    for(let i = 0; i < particles.length; i++)
    {
      var p = particles[i];

      var meshVert = 0;
      if(meshAttract)
      {
        meshVert = i;
       // debugger;
      } else {
        meshVert = -1;
      }

      var v = calculateForce(p, meshVert);
      p.applyForce(vec3.fromValues(v[0]/1500, v[1]/1500, v[2]/1500));
        
      


      p.step(dt);
     
      if(time % 10 == 0) {
         var newcol = cosColor(vec3.distance(p.currPos, mouseClickWorldLocation));
        p.color = vec4.fromValues(Math.max(0, newcol[0]), Math.max(0, newcol[1]), Math.max(0, newcol[2]), 1.0);
      }

      //update offsets array
      offsetsArray[i * 3] = p.currPos[0];
      offsetsArray[i * 3 + 1] = p.currPos[1];
      offsetsArray[i * 3 + 2] = p.currPos[2];

      //update color array
      colorsArray[i * 4] = p.color[0];
      colorsArray[i * 4 + 1] = p.color[1];
      colorsArray[i * 4 + 2] = p.color[2];
      colorsArray[i * 4 + 3] = p.color[3];
    }


    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear();
    renderer.render(camera, lambert, [
      square, rayCastDebug
    ]);
    stats.end();

    // Tell the browser to call `tick` again whenever it renders a new frame
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  // event listener for kepress
  window.addEventListener('keypress', (e: KeyboardEvent) => {
    if(e.key === "a")
    {
      attractParticles = true;
      repelParticles = false;
      console.log("Pressed A");
    } 
    if(e.key === "r")
    {
      attractParticles = false;
      repelParticles = true;
      console.log("Pressed R");
    }
  });

  window.addEventListener('mousedown',(ev: MouseEvent) => {
    mouseDownX = ev.screenX;
    mouseDownY = ev.screenY;
    // transform mosueclick (x,y) coords into worldspace coords
    mouseClickWorldLocation = raycast();
    console.log("x: " + mouseDownX + ", y: " + mouseDownY);
    console.log("world pos: " + mouseClickWorldLocation);
  });

  window.addEventListener('mouseup', (ev: MouseEvent) => {
    mouseUpX = ev.screenX;
    mouseUpY = ev.screenY;
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick();
}

main();
