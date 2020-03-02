//VERSION=3
function setup() {
  return {
    input: ["B8A", "B03", "B02","dataMask"],
    output: { bands: 3 }
  };
}

function evaluatePixel(sample) {
  return [sample.B8A*2.5,sample.B03*2.5,sample.B02*2.5,sample.dataMask];
}
