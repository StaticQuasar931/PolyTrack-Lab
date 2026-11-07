/* Visual dimensions follow the same local chassis and wheel axes as the solver. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab;
  const bounds={carScale:[.25,4],bodyWidth:[.5,2],bodyHeight:[.5,2],bodyLength:[.5,2],wheelRadius:[.5,2],wheelWidth:[.25,3],wheelTrack:[.5,2],wheelBase:[.5,2],suspensionLength:[.5,2]};
  const wheelBases=new WeakMap();
  function dimensions(car){const source=car?.labVehiclePreviewSettings||car?.labPhysicsValues||lab.getSettings();return Object.fromEntries(Object.entries(bounds).map(([key,[min,max]])=>[key,Number.isFinite(source?.[key])?Math.min(max,Math.max(min,source[key])):1]));}
  lab.vehicleDimensions=dimensions;
  lab.vehicleMassOffset=(car,original)=>{const s=dimensions(car);return original*s.carScale*s.bodyHeight;};
  lab.vehicleBodyMatrix=(car,matrix,suspension=false)=>{const s=dimensions(car),scale={x:s.carScale*s.bodyWidth*(suspension?s.wheelTrack:1),y:s.carScale*s.bodyHeight,z:s.carScale*s.bodyLength*(suspension?s.wheelBase:1)};if(scale.x!==1||scale.y!==1||scale.z!==1)matrix.scale(scale);return matrix;};
  lab.vehicleWheelPosition=(car,position)=>{const s=dimensions(car);position.x*=s.carScale*s.bodyWidth*s.wheelTrack;position.y*=s.carScale*s.bodyHeight;position.z*=s.carScale*s.bodyLength*s.wheelBase;return position;};
  lab.vehicleSuspension=(car,length)=>{const s=dimensions(car);return car?.labVehicleStaticPose?length*s.carScale*s.suspensionLength:length;};
  lab.vehicleWheelMesh=(car,wheel)=>{const s=dimensions(car);if(!wheelBases.has(wheel))wheelBases.set(wheel,{x:wheel.scale.x,y:wheel.scale.y,z:wheel.scale.z});const b=wheelBases.get(wheel),x=b.x*s.carScale*s.wheelWidth,y=b.y*s.carScale*s.wheelRadius,z=b.z*s.carScale*s.wheelRadius;if(wheel.scale.x!==x||wheel.scale.y!==y||wheel.scale.z!==z)wheel.scale.set(x,y,z);};
  lab.vehicleCameraScale=car=>{const s=dimensions(car);return Math.max(1,s.carScale*Math.max(s.bodyWidth,s.bodyLength,s.bodyHeight,s.wheelRadius));};
  lab.vehicleCockpitOffset=(vector,car)=>{const s=dimensions(car);vector.x*=s.carScale*s.bodyWidth;vector.y*=s.carScale*s.bodyHeight;vector.z*=s.carScale*s.bodyLength;return vector;};
  function previewBounds(values){
    const s=dimensions({labVehiclePreviewSettings:values||lab.getDefaults()}),x=s.carScale*s.bodyWidth,y=s.carScale*s.bodyHeight,z=s.carScale*s.bodyLength;
    // Extents come from the supplied car.glb Body/Exhaust and Tire accessors.
    // Wheel centers and unloaded suspension lengths are the native car constants.
    const min={x:-.701253354549408*x,y:(.6-.4104353189468384)*y,z:-2.00805401802063*z};
    const max={x:.701253354549408*x,y:(.6+.38012614846229553)*y,z:1.6543552875518799*z};
    const halfWidth=.17195217311382294*s.carScale*s.wheelWidth,radius=.33065855503082275*s.carScale*s.wheelRadius;
    for(const [baseX,baseZ,suspension] of [[.627909,1.3478,.07809501004219055],[-.627909,1.3478,.07809501004219055],[.720832,-1.52686,.0781289680480957],[-.720832,-1.52686,.0781289680480957]]){
      const center={x:baseX*x*s.wheelTrack,y:.27*y-suspension*s.carScale*s.suspensionLength,z:baseZ*z*s.wheelBase};
      min.x=Math.min(min.x,center.x-halfWidth);max.x=Math.max(max.x,center.x+halfWidth);
      min.y=Math.min(min.y,center.y-radius);max.y=Math.max(max.y,center.y+radius);
      min.z=Math.min(min.z,center.z-radius);max.z=Math.max(max.z,center.z+radius);
    }
    return {min,max};
  }
  function projectedSize(box){const x=box.max.x-box.min.x,y=box.max.y-box.min.y,z=box.max.z-box.min.z;return {width:(x+z)/Math.sqrt(2),height:(x+z)/Math.sqrt(6)+y*Math.sqrt(2/3)};}
  lab.vehiclePreviewBounds=previewBounds;
  lab.vehiclePreviewOptions=values=>{
    const vehicleValues=values||lab.getDefaults(),box=previewBounds(vehicleValues),projected=projectedSize(box),original=projectedSize(previewBounds(lab.getDefaults()));
    const fit=Math.max(1,projected.width/original.width,projected.height/original.height),center={x:(box.min.x+box.max.x)/2,y:(box.min.y+box.max.y)/2,z:(box.min.z+box.max.z)/2};
    return {vehicleValues,zoom:.5/fit,look:{isVector3:true,...center},position:{x:center.x+1000,y:center.y+1000,z:center.z+1000},framing:fit>1?'fit':'original-reference'};
  };
})();
