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

   }


}
export default Particle;