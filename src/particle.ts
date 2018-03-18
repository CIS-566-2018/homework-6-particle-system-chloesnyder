import {vec3, vec4} from 'gl-matrix';
import Square from './geometry/Square';

class Particle {
   currPos : vec3;
   currVel : vec3;

   prevPos : vec3;
   prevVel : vec3;

   offset : vec3;
   color : vec4;
   acceleration : vec3;

   mass : number;
   id : number;

   constructor(pos : vec3, vel : vec3, acc : vec3, offset : vec3, color: vec4, id: number)
   {
        this.currPos = pos;
        this.currVel = vel;
        this.acceleration = acc;

        this.prevPos = pos;
        this.prevVel = vel;

        this.offset = offset;
        this.color = color;

        this.mass = 2.0;
        this.id = id;
   }

   // update position with verlet integration
   step(dt: number)
   {
  
        var newPos = vec3.create();
        var currPosMinusOldPos = vec3.create();
        var positionTerm = vec3.create();
        var accelerationTerm = vec3.create();
        
        // p - p*
        vec3.subtract(currPosMinusOldPos, this.currPos, this.prevPos);
        // p + (p - p*)
        vec3.add(positionTerm, this.currPos, currPosMinusOldPos);
        // a * (dt^2)
        var dt2 = dt * dt;
        vec3.scale(accelerationTerm, this.acceleration, dt2);
        // p' = p + (p - p*) + a*(dt^2)
        vec3.add(newPos, positionTerm, accelerationTerm);

        //update previous and current positions
        this.prevPos = this.currPos;
        this.currPos = newPos;

        if(dt % 1000 == 0) 
        {

            //update color
            // color takes distance from origin as input for time being. In future, update this to be distance from attractor/repellor force, i.e. mouseclick (x,y)
            var t = vec3.dist(this.currPos, vec3.fromValues(0, 0, 0));
            var vec3color = this.cosColor(t);
            this.color = vec4.fromValues(Math.max(0, vec3color[0]), Math.max(0, vec3color[1]), Math.max(0, vec3color[2]), 1.0);
        }
        

   }

    cosColor(t: number) : vec3
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

   // updates the acceleration
   applyForce(f: vec3)
   {
       
        var newAcc = vec3.create();
        vec3.scale(newAcc, f, 1/this.mass);
        this.acceleration = newAcc;
   }


}
export default Particle;