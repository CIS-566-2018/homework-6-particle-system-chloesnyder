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

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
  tesselations: 5,
  'Load Scene': loadScene, // A function pointer, essentially
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

let attractParticles: boolean;
let repelParticles: boolean;


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
  particles = new Array<Particle>();
  square = new Square();
  square.create();

  // Set up particles here. Hard-coded example data for now
  offsetsArray = [];
  colorsArray = [];
  n = 10.0;
  var id = 0;
  
  for(let i = 0; i < n; i++) {
    for(let j = 0; j < n; j++) {
      var position = vec3.fromValues(i, j, 0);
      var velocity = vec3.fromValues(0, 0, 0);
      var acceleration = vec3.fromValues(0, 0, 0);
      var offset = vec3.fromValues(i, j, 0);

      var t = vec3.dist(position, vec3.fromValues(0,0,0)); // color takes distance from origin as input for time being. In future, update this to be distance from attractor/repellor force, i.e. mouseclick (x,y)
      var vec3color = cosColor(t);
      var color = vec4.fromValues(Math.max(0, vec3color[0]), Math.max(0, vec3color[1]), Math.max(0, vec3color[2]), 1.0);
      var currParticle = new Particle(position, velocity, acceleration, offset, color, id);
      particles.push(currParticle);

      offsetsArray.push(i);
      offsetsArray.push(j);
      offsetsArray.push(0);

      colorsArray.push(color[0]);
      colorsArray.push(color[1]);
      colorsArray.push(color[2]);
      colorsArray.push(1.0); // Alpha channel
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

  const camera = new Camera(vec3.fromValues(50, 50, 10), vec3.fromValues(50, 50, 0));

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

    // P = ViewMat-1 * ProjMat-1 * ((sx, sy, 1,1 ) * farClip)
    var viewMat = mat4.create();
    mat4.invert(viewMat, camera.viewMatrix);
    var projMat = mat4.create();
    mat4.invert(projMat, camera.projectionMatrix);
    var screenPos = vec4.fromValues(sx, sy, 1.0, 1.0);
    var v = vec4.create();
    vec4.scale(v, screenPos, camera.far);
    var viewProjMat = mat4.create();
    mat4.multiply(viewProjMat, viewMat, projMat);
    var p = vec4.create();
    transformMat4(p, v, viewProjMat);
    var toReturn = vec3.fromValues(p[0], p[1], p[2]);
   // console.log(toReturn);
    return toReturn;
   
   /*// 2) screen point to world point
    // ref = eye + t * F, where t = any float > 0
    var t = .5;
    var scaleF = vec3.create();
    var ref = vec3.create();
    vec3.scale(scaleF, camera.forward, t);
    vec3.add(ref, camera.position, scaleF);
    // len = |ref - eye|
    var refminuseye = vec3.create();
    vec3.subtract(refminuseye, ref, camera.position);
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
    vec3.add(p, ref, sxH);
    vec3.add(p, p, syV);

    return p;*/

    // 3) 

  }

  // referenced http://natureofcode.com/book/chapter-2-forces/
  function calculateForce(p : Particle) : vec3
  {
    // transform mosueclick (x,y) coords into worldspace coords
    var mouseClickWorldLocation = raycast();
    // calculate direction (mousePos - particlePos)
    var direction = vec3.create();
    vec3.subtract(direction, mouseClickWorldLocation, p.currPos);
    vec3.normalize(direction, direction);

    var G = 6.67428 * Math.pow(10, -11);
    var mass1 = p.mass;
    var mass2 = 300 * mass1; // arbitrarily setting mass of attractor to be 3 times that of a particle
    var distance = vec3.distance(mouseClickWorldLocation, p.currPos);
    var m = (G * mass1 * mass2) / (distance * distance);
    var dir = vec3.create();

    if(attractParticles)
    {    
      vec3.scale(dir, direction, m);

    } else if (repelParticles)
    {
      vec3.scale(dir, direction, m * -1.0);
    }
    return dir;
  }

  // This function will be called every frame
  function tick() {
    camera.update();
    stats.begin();

    var oldTime = time;
    lambert.setTime(time++);
    var dt = time - oldTime;

    let offsets: Float32Array = new Float32Array(offsetsArray);
    let colors: Float32Array = new Float32Array(colorsArray);
    square.setInstanceVBOs(offsets, colors);
    square.setNumInstances(n * n); // 10x10 grid of "particles"

    // update the positions of all the particles
    for(let i = 0; i < particles.length; i++)
    {
      let p = particles[i];

      var v = vec3.create();
      vec3.scale(v, calculateForce(p), 100000000);
      //if(attractParticles && !isNaN(mouseDownX))   {debugger;}
      p.applyForce(v);
      p.step(dt);
     
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
      square,
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
    console.log("x: " + mouseDownX + ", y: " + mouseDownX);
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
