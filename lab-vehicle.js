/* Visual dimensions follow the same local chassis and wheel axes as the solver. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab;
  const bounds={carScale:[.25,4],bodyWidth:[.5,2],bodyHeight:[.5,2],bodyLength:[.5,2],wheelRadius:[.5,2],wheelWidth:[.25,3],wheelTrack:[.5,2],wheelBase:[.5,2],suspensionLength:[.5,2]};
  const wheelBases=new WeakMap();
  function dimensions(car){const source=car?.labVehiclePreviewSettings||lab.getSettings();return Object.fromEntries(Object.entries(bounds).map(([key,[min,max]])=>[key,Number.isFinite(source?.[key])?Math.min(max,Math.max(min,source[key])):1]));}
  lab.vehicleDimensions=dimensions;
  lab.vehicleMassOffset=(car,original)=>{const s=dimensions(car);return original*s.carScale*s.bodyHeight;};
  lab.vehicleBodyMatrix=(car,matrix,suspension=false)=>{const s=dimensions(car),scale={x:s.carScale*s.bodyWidth*(suspension?s.wheelTrack:1),y:s.carScale*s.bodyHeight,z:s.carScale*s.bodyLength*(suspension?s.wheelBase:1)};if(scale.x!==1||scale.y!==1||scale.z!==1)matrix.scale(scale);return matrix;};
  lab.vehicleWheelPosition=(car,position)=>{const s=dimensions(car);position.x*=s.carScale*s.bodyWidth*s.wheelTrack;position.y*=s.carScale*s.bodyHeight;position.z*=s.carScale*s.bodyLength*s.wheelBase;return position;};
  lab.vehicleSuspension=(car,length)=>{const s=dimensions(car);return car?.labVehicleStaticPose?length*s.carScale*s.suspensionLength:length;};
  lab.vehicleWheelMesh=(car,wheel)=>{const s=dimensions(car);if(!wheelBases.has(wheel))wheelBases.set(wheel,{x:wheel.scale.x,y:wheel.scale.y,z:wheel.scale.z});const b=wheelBases.get(wheel),x=b.x*s.carScale*s.wheelWidth,y=b.y*s.carScale*s.wheelRadius,z=b.z*s.carScale*s.wheelRadius;if(wheel.scale.x!==x||wheel.scale.y!==y||wheel.scale.z!==z)wheel.scale.set(x,y,z);};
  lab.vehicleCameraScale=()=>{const s=dimensions();return Math.max(.5,s.carScale*Math.max(s.bodyWidth,s.bodyLength,s.bodyHeight,s.wheelRadius));};
  lab.vehicleCockpitOffset=vector=>{const s=dimensions();vector.x*=s.carScale*s.bodyWidth;vector.y*=s.carScale*s.bodyHeight;vector.z*=s.carScale*s.bodyLength;return vector;};
  lab.vehiclePreviewOptions=values=>{const s=dimensions({labVehiclePreviewSettings:values||lab.getDefaults()});return {vehicleValues:values||lab.getDefaults(),zoom:.5/Math.max(1,s.carScale*Math.max(s.bodyWidth,s.bodyLength,s.bodyHeight,s.wheelRadius,s.wheelWidth*.5))};};
})();
