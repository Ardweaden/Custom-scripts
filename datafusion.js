//VERSION=3
var setup = () => ({
  input: [
    {datasource: "s1grd", bands:["VH"], units: "REFLECTANCE"},
    {datasource: "s2l2a", bands:["B02", "B03", "B04"], units: "REFLECTANCE", mosaicking: "ORBIT"},
    {datasource: "s2l1c", bands:["B02", "B03", "B04"], units: "REFLECTANCE"}],
  output: [
    {id: "default", bands: 3, sampleType: SampleType.AUTO}
  ]
});

function evaluatePixel(samples, inputData, inputMetadata, customData, outputMetadata) {
  var sample = samples.s2l2a[0];
  if (!sample) {
    return {
      default: [0, 0, 0],
    }
  }
  let val = [sample.B04, sample.B03, sample.B02];

  return {
    default: val
  }
}
