//VERSION=3
function setup() {
  return {
    input: ['B01','B02'],
    output: { bands: 1, sampleType: "FLOAT32" },
    mosaicking: "ORBIT"
  };
}

function updateOutput(outputs, collection) {
    Object.values(outputs).forEach((output) => {
        output.bands = 0 + 2 ;
    });
}
function parse_rfc3339(dt, default_h = 0, default_m = 0, default_s = 0) {
  const regexDateTime =
    "^([0-9]{4})-([0-9]{2})-([0-9]{2})([Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(\\.[0-9]+)?)?(([Zz]|([+-])([0-9]{2}):([0-9]{2})))?";
  const regexDate = "^([0-9]{4})-([0-9]{2})-([0-9]{2})$";

  let result = null;

  try {
    const g = dt.match(regexDateTime);
    if (g) {
      let date = Date.UTC(
        parseInt(g[1]), //year
        parseInt(g[2]) - 1, // month
        parseInt(g[3]), //day
        parseInt(g[5] || default_h), //hour
        parseInt(g[6] || default_m), //minute
        parseInt(g[7] || default_s), // second
        parseFloat(g[8]) * 1000 || 0 // milisecond
      );

      //for date-time strings either time zone or Z should be provided
      if (g[5] !== undefined && g[9] === undefined) {
        return null;
      }

      //check if timezone is provided
      if (g[9] !== undefined && g[9] !== "Z") {
        //offset in minutes
        const offset =
          (parseInt(g[12] || 0) * 60 + parseInt(g[13] || 0)) *
          (g[11] === "+" ? -1 : 1);
        //add offset in miliseconds
        date = date + offset * 60 * 1000;
      }

      return {
        type: dt.match(regexDate) ? "date" : "date-time",
        value: new Date(date).toISOString(),
      };
    }
  } catch (err) {
    //
  }

  return result;
}

function parse_rfc3339_time(t) {
  const regexTime = "(([0-9]{2}):([0-9]{2}):([0-9]{2})(\\.[0-9]+)?)?(([Zz]|([+-])([0-9]{2}):([0-9]{2})))";
  try {
    const g = t.match(regexTime);
    if (g) {
      let date = Date.UTC(
        0, // year
        0, // month
        1, // day
        parseInt(g[2]), // hour
        parseInt(g[3]), // minute
        parseInt(g[4]), // second
        parseFloat(g[5]) * 1000 || 0 // milisecond
      );

      // for time strings either time zone or Z should be provided
      if (g[2] !== undefined && g[6] === undefined) {
        return null;
      }

      // check if timezone is provided
      if (g[6] !== undefined && g[6] !== "Z") {
        // offset in minutes
        const offset =
          (parseInt(g[9] || 0) * 60 + parseInt(g[10] || 0)) *
          (g[8] === "+" ? -1 : 1);
        // add offset in miliseconds
        date = date + offset * 60 * 1000;
      }

      return {
        type: "time",
        value: new Date(date).toISOString(),
      };
    }
  } catch (err) {}

  return null;
}

const formatLabelByPeriod = (period, label) => {
  const dayInYear = (date) => {
    return (
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        Date.UTC(date.getUTCFullYear(), 0, 0)) /
      24 /
      60 /
      60 /
      1000
    );
  };

  const dekadInYear = (date) => {
    const monthCount = date.getUTCMonth();
    const dekadCount = Math.floor((date.getUTCDate() - 1) / 10) + 1;
    return monthCount * 3 + (dekadCount > 2 ? 3 : dekadCount);
  };

  const padWithZeros = (num, size) => {
    num = num.toString();
    while (num.length < size) {
      num = "0" + num;
    }
    return num;
  };

  const d = new Date(label);
  switch (period) {
    case "hour":
      const hourCount = d.toISOString().split("T")[1].substring(0, 2);
      const days = d.getUTCDate();
      const months = d.getUTCMonth() + 1;
      return `${d.getUTCFullYear()}-${padWithZeros(months, 2)}-${padWithZeros(
        days,
        2
      )}-${hourCount}`;
    case "day":
      const dayCount = dayInYear(d);
      return `${d.getUTCFullYear()}-${padWithZeros(dayCount, 3)}`;
    case "week":
      const weekCount = Math.ceil(dayInYear(d) / 7);
      return `${d.getUTCFullYear()}-${padWithZeros(weekCount, 2)}`;
    case "dekad":
      const dekadCount = dekadInYear(d);
      return `${d.getUTCFullYear()}-${padWithZeros(dekadCount, 2)}`;
    case "month":
      const monthCount = d.getUTCMonth() + 1;
      return `${d.getUTCFullYear()}-${padWithZeros(monthCount, 2)}`;
    case "season":
      const month = d.getUTCMonth() + 1;
      let seasonName = null;
      if (month >= 3 && month <= 5) {
        seasonName = "mam";
      } else if (month >= 6 && month <= 8) {
        seasonName = "jja";
      } else if (month >= 9 && month <= 11) {
        seasonName = "son";
      } else {
        seasonName = "djf";
      }
      return `${d.getUTCFullYear()}-${seasonName}`;
    case "tropical-season":
      let tropicalSeasonName = null;
      if (d.getUTCMonth() + 1 >= 5 && d.getUTCMonth() + 1 <= 10) {
        tropicalSeasonName = "mjjaso";
      } else {
        tropicalSeasonName = "ndjfma";
      }
      return `${d.getUTCFullYear()}-${tropicalSeasonName}`;
    case "year":
      return `${d.getUTCFullYear()}`;
    case "decade":
      return `${d.getUTCFullYear().toString().substring(0, 3)}0`;
    case "decade-ad":
      return `${d.getUTCFullYear().toString().substring(0, 3)}1`;
    default:
      throw new ProcessError({
        name: "UnknownPeriodValue",
        message: `Value '${period}' is not an allowed value for period.`,
      });
  }
};

const generateDatesInRangeByPeriod = (minDate, maxDate, period) => {
  const addPeriodToDate = (currentDate, period) => {
    let newDate = new Date(currentDate);
    switch (period) {
      case "hour":
        newDate.setUTCHours(newDate.getUTCHours() + 1);
        return newDate.toISOString();
      case "day":
        newDate.setUTCDate(newDate.getUTCDate() + 1);
        return newDate.toISOString();
      case "week":
        newDate.setUTCDate(newDate.getUTCDate() + 7);
        return newDate.toISOString();
      case "dekad":
        if (newDate.getUTCDate() > 20) {
          newDate.setUTCDate(1);
          newDate.setUTCMonth(newDate.getUTCMonth() + 1);
        } else {
          newDate.setUTCDate(newDate.getUTCDate() + 10);
        }
        return newDate.toISOString();
      case "month":
        newDate.setUTCMonth(newDate.getUTCMonth() + 1);
        return newDate.toISOString();
      case "season":
        newDate.setUTCMonth(newDate.getUTCMonth() + 3);
        return newDate.toISOString();
      case "tropical-season":
        newDate.setUTCMonth(newDate.getUTCMonth() + 6);
        return newDate.toISOString();
      case "year":
        newDate.setUTCFullYear(newDate.getUTCFullYear() + 1);
        return newDate.toISOString();
      case "decade":
        newDate.setUTCFullYear(newDate.getUTCFullYear() + 10);
        return newDate.toISOString();
      case "decade-ad":
        newDate.setUTCFullYear(newDate.getUTCFullYear() + 10);
        return newDate.toISOString();
      default:
        throw new ProcessError({
          name: "UnknownPeriodValue",
          message: `Value '${period}' is not an allowed value for period.`,
        });
    }
  };

  const dates = [];
  let currentDate = minDate;

  while (currentDate <= maxDate) {
    dates.push(currentDate);
    currentDate = addPeriodToDate(currentDate, period);
  }

  return dates;
};

const getMinMaxDate = (labels) => {
  let minDate = parse_rfc3339(labels[0]).value;
  let maxDate = minDate;

  for (let i = 1; i < labels.length; i++) {
    const currentDate = parse_rfc3339(labels[i]).value;

    if (currentDate < minDate) {
      minDate = currentDate;
    }

    if (currentDate > maxDate) {
      maxDate = currentDate;
    }
  }

  return { minDate, maxDate };
};

class ProcessError extends Error {
  constructor({ name, message }) {
    super(message);
    this.name = name;
  }
}

class ValidationError extends Error {
  constructor({ name, message }) {
    super(message);
    this.name = name;
  }
}

const VALIDATION_ERRORS = {
  MISSING_PARAMETER: "MISSING_PARAMETER",
  WRONG_TYPE: "WRONG_TYPE",
  NOT_NULL: "NOT_NULL",
  NOT_ARRAY: "NOT_ARRAY",
  NOT_INTEGER: "NOT_INTEGER",
  MIN_VALUE: "MIN_VALUE",
  MAX_VALUE: "MAX_VALUE",
};

function validateParameter(arguments) {
  const {
    processName,
    parameterName,
    value,
    required = false,
    nullable = true,
    allowedTypes,
    array,
    integer,
    min,
    max,
  } = arguments;

  if (!!required && value === undefined) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.MISSING_PARAMETER,
      message: `Process ${processName} requires parameter ${parameterName}.`,
    });
  }

  if (!nullable && value === null) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.NOT_NULL,
      message: `Value for ${parameterName} should not be null.`,
    });
  }

  if (
    allowedTypes &&
    Array.isArray(allowedTypes) &&
    value !== null &&
    value !== undefined &&
    !allowedTypes.includes(typeof value)
  ) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.WRONG_TYPE,
      message: `Value for ${parameterName} is not a ${allowedTypes.join(
        " or a "
      )}.`,
    });
  }

  if (array && !Array.isArray(value)) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.NOT_ARRAY,
      message: `Value for ${parameterName} is not an array.`,
    });
  }

  if (integer && !Number.isInteger(value)) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.NOT_INTEGER,
      message: `Value for ${parameterName} is not an integer.`,
    });
  }

  if (min !== undefined && min !== null && value < min) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.MIN_VALUE,
      message: `Value for ${parameterName} must be greater or equal to ${min}.`,
    });
  }

  if (max !== undefined && max !== null && value > max) {
    throw new ValidationError({
      name: VALIDATION_ERRORS.MAX_VALUE,
      message: `Value for ${parameterName} must be less or equal to ${max}.`,
    });
  }

  return true;
}

// The MIT License (MIT)

// Copyright (c) 2013-2016 Mikola Lysenko

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}
function isBuffer (obj) {
  return obj != null && obj.constructor != null &&
    typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
      case "[object BigInt64Array]":
        return "bigint64"
      case "[object BigUint64Array]":
        return "biguint64"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "bigint64": [],
  "biguint64": [],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function ndarray(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

// ------------------------------------------------------------------------------------------------------

function convert_to_1d_array(ndarray) {
    const arr = []
    for (let i = 0; i < ndarray.shape[0]; i++) {
        arr.push(ndarray.get(i))
    }
    return arr
}

function extractValues(obj) {
    const values = [];
    for (var key in obj) {
        values.push(obj[key]);
    }
    return values;
}

function fill(arr, val) {
    const size = arr.length
    for (let i = 0; i < size; i++) {
        arr[i] = val
    }
    return arr
}

function isNotSubarray(ndarray, shape) {
    let length = 1;
    for (let i = 0; i < shape.length; i++) {
        length *= shape[i]
    }
    return length === ndarray.data.length
}

function flattenToNativeArray(ndarray, useAllNdarrayProperties = false) {
    const shape = ndarray.shape

    if (!useAllNdarrayProperties && isNotSubarray(ndarray, shape)) {
      return ndarray.data.slice();
    }
  
    const cumulatives = fill(shape.slice(), 0);
    const coord = shape.slice();
    const arr = []
    let total = 1;

    for (let d = shape.length - 1; d >= 0; d--) {
        cumulatives[d] = total;
        total *= shape[d];
    }
    for (let i = 0; i < total; i++) {
        for (let d = shape.length - 1; d >= 0; d--) {
            coord[d] = Math.floor(i / cumulatives[d]) % shape[d];
        }
        arr.push(ndarray.get.apply(ndarray, coord))
    }
    return arr
}

/**
* @license Apache-2.0
*
* Copyright (c) 2021 The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

function broadcastNdarray(inputArray, targetShape) {
  
  const targetNumOfDimensions = targetShape.length;
  const inputArrayNumOfDimensions = inputArray.shape.length;

  if (targetNumOfDimensions < inputArrayNumOfDimensions) {
    throw new Error('invalid argument. Cannot broadcast an array to a shape having fewer dimensions. Arrays can only be broadcasted to shapes having the same or more dimensions.');
  }

  // Initialize a strides array...
  let generatedStrides = [];
  for (let i = 0; i < targetNumOfDimensions; i++) {
    generatedStrides.push(0);
  }

  // Determine the output array strides...
  const inputArrayStride = inputArray.stride;
  for (let i = targetNumOfDimensions - 1; i >= 0; i--) {
    const dimIndexInShape = inputArrayNumOfDimensions - targetNumOfDimensions + i;
    const inputArrayDim = inputArray.shape[dimIndexInShape];
    const currentDim = targetShape[i];

    if (dimIndexInShape < 0) {
      // Prepended singleton dimension; stride is zero...
      continue;
    }
    
    if (currentDim !== 0 && currentDim < inputArrayDim) {
      throw new Error(format('invalid argument. Input array cannot be broadcast to the specified shape, as the specified shape has a dimension whose size is less than the size of the corresponding dimension in the input array. Array shape: (%s). Desired shape: (%s). Dimension: %u.', inputArray.shape.slice().join(', '), targetShape.slice().join(', '), i));
    }
    if (inputArrayDim === currentDim) {
      generatedStrides[i] = inputArrayStride[dimIndexInShape];
    } else if (inputArrayDim === 1) {
      // In order to broadcast dimensions, we set the stride for that dimension to zero...
      generatedStrides[i] = 0;
    } else {
      // At this point, we know that `dim > d` and that `d` does not equal `1` (e.g., `dim=3` and `d=2`); in which case, the shapes are considered incompatible (even for desired shapes which are multiples of array dimensions, as might be desired when "tiling" an array; e.g., `dim=4` and `d=2`)...
      throw new Error(format('invalid argument. Input array and the specified shape are broadcast incompatible. Array shape: (%s). Desired shape: (%s). Dimension: %u.', inputArray.shape.slice().join(', '), targetShape.slice().join(', '), i));
    }
  }
  const newArr = ndarray(inputArray.data, targetShape.slice(), generatedStrides, inputArray.offset);
  return newArr;
}

class DataCube {
    // data: SH samples or an ndarray
    // bands_dimension_name: name  to use for the default bands dimension
    // temporal_dimension_name: name to use for the default temporal dimension
    // fromSamples: boolean, if true `data` is expected to be in format as argument `samples` passed to `evaluatePixel` in an evalscript, else ndarray
    constructor(data, bands_dimension_name, temporal_dimension_name, fromSamples, bands_metadata, scenes) {
        this.TEMPORAL = "temporal"
        this.BANDS = "bands"
        this.OTHER = "other"
        this.bands_dimension_name = bands_dimension_name;
        this.temporal_dimension_name = temporal_dimension_name;
        this.dimensions = [{
            name: this.temporal_dimension_name,
            labels: [],
            type: this.TEMPORAL
        }, {
            name: this.bands_dimension_name,
            labels: [],
            type: this.BANDS
        }]
        if (fromSamples) {
            this.data = this.makeArrayFromSamples(data)
        } else {
            this.data = data;
        }
        if (scenes) {
            let dates = [];
            for (let scene of scenes) {
                dates.push(scene.date);
            }
            this.setDimensionLabels(this.temporal_dimension_name, dates);
        }
        this.bands_metadata = bands_metadata
    }

    getDimensionByName(name) {
        return this.dimensions.find(d => d.name === name)
    }

    getTemporalDimension() {
        const temporalDimensions = this.getTemporalDimensions();

        if (temporalDimensions.length > 1) {
            throw new Error(`Too many temporal dimensions found`);
        }

        return temporalDimensions[0];
    }

    getTemporalDimensions() {
        const temporalDimensions = this.dimensions.filter(d => d.type === this.TEMPORAL);

        if (temporalDimensions.length === 0) {
            throw new Error("No temporal dimension found.");
        }

        return temporalDimensions;
    }

    setDimensionLabels(dimension, labels) {
        for (let dim of this.dimensions) {
            if (dim.name === dimension) {
                dim.labels = labels
            }
        }
    }

    // Converts `samples` object to ndarray of shape [number of samples, number of bands]
    // `samples` is eqivalent to the first argument of `evaluatePixel` method in an evalscript
    // Either object or array of objects (non-temporal and temporal scripts respectively)
    makeArrayFromSamples(samples) {
        if (Array.isArray(samples)) {
            if (samples.length === 0) {
                return ndarray([], [0, 0])
            }
            this._setDimensionLabelsIfEmpty(this.bands_dimension_name, Object.keys(samples[0]))
            let newData = []
            for (let entry of samples) {
                newData = newData.concat(extractValues(entry))
            }
            return ndarray(newData, [samples.length, extractValues(samples[0]).length])
        } else {
            this._setDimensionLabelsIfEmpty(this.bands_dimension_name, Object.keys(samples))
            const newData = Object.values(samples)
            return ndarray(newData, [1, newData.length])
        }
    }

    _setDimensionLabelsIfEmpty(dimension, labels) {
        if (this.getDimensionByName(dimension).labels.length === 0) {
            this.getDimensionByName(dimension).labels = labels
        }
    }

    getBandIndices(bands) {
        const bandsLabels = this.getDimensionByName(this.bands_dimension_name).labels
        const indices = []
        for (let band of bands) {
            const ind = bandsLabels.indexOf(band)
            if (ind !== -1) {
                indices.push(ind)
            }
        }
        return indices
    }

    getFilteredTemporalIndices(temporalDimension, start, end) {
        const temporalLabels = this.getDimensionByName(temporalDimension).labels;
        const indices = [];
        for (let i = 0; i < temporalLabels.length; i++) {
            const date = start?.type === 'time'
                ? parse_rfc3339_time(temporalLabels[i])
                : parse_rfc3339(temporalLabels[i]);

            if (!date) {
                throw new Error("Invalid ISO date string in temporal dimension label.");
            }

            if ((start === null || date.value >= start.value) && (end === null || date.value < end.value)) {
                indices.push(i);
            }
        }
        return indices;
    }

    getBand(name) {
        let bandToReturn = null
        for (let band of this.bands_metadata) {
            if (band.common_name === name) {
                bandToReturn = band;
            }

            if (band.name === name) {
                bandToReturn = band;
                break;
            }
        }

        return bandToReturn;
    }

    filterBands(bands) {
        const indices = this.getBandIndices(bands);
        const axis = this.dimensions.findIndex((e) => e.name === this.bands_dimension_name);
        this._filter(axis, indices);
        this.getDimensionByName(this.bands_dimension_name).labels =
            this.getDimensionByName(this.bands_dimension_name).labels.filter((lab) =>
                bands.includes(lab)
            );
    }

    filterTemporal(extent, dimensionName) {
        if (dimensionName) {
            const dimension = this.getDimensionByName(dimensionName);

            if (dimension === undefined) {
                throw new Error(`Dimension not available.`);
            }

            if (dimension.type !== this.TEMPORAL) {
                throw new Error(`Dimension is not of type temporal.`);
            }

            this._filterTemporalByDimension(extent, dimension);

        } else {
            const dimensions = this.getTemporalDimensions();
            for (let dimension of dimensions) {
                this._filterTemporalByDimension(extent, dimension);
            }
        }
    }

    _filterTemporalByDimension(extent, dimension) {
        const axis = this.dimensions.findIndex((e) => e.name === dimension.name);
        const temporalLabels = dimension.labels;

        const parsedExtent = this.parseTemporalExtent(extent);
        const indices = this.getFilteredTemporalIndices(dimension.name, parsedExtent.start, parsedExtent.end);

        this._filter(axis, indices);
        dimension.labels = indices.map(i => temporalLabels[i]);
    }

    aggregateTemporal(intervals, reducer, labels, dimensionName, context) {
        const dimension = dimensionName ? this.getDimensionByName(dimensionName) : this.getTemporalDimension();
        if (dimension === undefined) {
            throw new Error(`Dimension not available.`);
        }
        if (dimension.type !== this.TEMPORAL) {
            throw new Error(`Dimension is not of type temporal.`);
        }

        const axis = this.dimensions.findIndex((e) => e.name === dimension.name);
        const data = this.data;
        const newValues = [];
        const computedLabels = [];

        if (labels && labels.length > 0 && labels.length !== intervals.length) {
            throw new Error('Number of labels must match number of intervals');
        }

        for (let interval of intervals) {
            if ((!labels || labels.length === 0) && computedLabels.includes(interval[0])) {
                throw new Error('Distinct dimension labels required');
            }
            computedLabels.push(interval[0]);

            const parsedInterval = this.parseTemporalExtent(interval);
            const indices = this.getFilteredTemporalIndices(dimension.name, parsedInterval.start, parsedInterval.end);

            const allCoords = this._iterateCoords(data.shape.slice(), [axis]);
            for (let coord of allCoords) {
                const entireDataToReduce = convert_to_1d_array(data.pick.apply(data, coord));
                const dataToReduce = [];
                for (let index of indices) {
                    dataToReduce.push(entireDataToReduce[index]);
                }

                const newVals = reducer({
                    data: dataToReduce,
                    context: context,
                });
                newValues.push(newVals);
            }
        }

        const newShape = data.shape.slice();
        newShape[axis] = intervals.length;
        this.data = ndarray(newValues, newShape);
        dimension.labels = labels && labels.length > 0 ? labels : computedLabels;
    }

    aggregateTemporalPeriod(period, reducer, dimension, context) {
        const temporalDimensions = this.getTemporalDimensions();
        if (!dimension && temporalDimensions.length > 1) {
          throw new ProcessError({
            name: "TooManyDimensions",
            message:
              "The data cube contains multiple temporal dimensions. The parameter `dimension` must be specified.",
          });
        }
      
        const temporalDimensionToAggregate = dimension ? this.getDimensionByName(dimension) : temporalDimensions[0];
        if (!temporalDimensionToAggregate) {
          throw new ProcessError({
            name: "DimensionNotAvailable",
            message: "A dimension with the specified name does not exist.",
          });
        }
      
        const axis = this.dimensions.findIndex(
          (d) => (d.name = temporalDimensionToAggregate.name)
        );
        const newLabels = [];
        const newValues = [];
      
        if (temporalDimensionToAggregate.labels.length > 1) {
          const { minDate, maxDate } = getMinMaxDate(
            temporalDimensionToAggregate.labels
          );
          const firstDayInYear = new Date(minDate)
          firstDayInYear.setMonth(0)
          firstDayInYear.setDate(1)
      
          const dates = generateDatesInRangeByPeriod(firstDayInYear.toISOString(), maxDate, period);
          let shouldAdd = false;
          for (let i = 0; i < dates.length; i++) {
              if (!shouldAdd && formatLabelByPeriod(period, dates[i]) === formatLabelByPeriod(period,minDate)) {
                shouldAdd = true;
              }  

              if (shouldAdd) {
                newLabels.push(formatLabelByPeriod(period, dates[i]));
              }
          }
        } else {
          newLabels.push(
            formatLabelByPeriod(period, temporalDimensionToAggregate.labels[0])
          );
        }

        const formattedOldLabels = temporalDimensionToAggregate.labels.map(l => formatLabelByPeriod(period, l))
        for (let newLabel of newLabels) {
          const allCoords = this._iterateCoords(this.data.shape.slice(), [axis]);
          const indices = []
          for (let i = 0; i < formattedOldLabels.length; i++) {
              if (newLabel === formattedOldLabels[i]) {
                  indices.push(i)
                }
          }

          for (let coord of allCoords) {
            const entireDataToReduce = convert_to_1d_array(this.data.pick.apply(this.data, coord));

            if (!formattedOldLabels.includes(newLabel)) {
                newValues.push(null);
            } else {
                const dataToReduce = []
                for (let index of indices) {
                    dataToReduce.push(entireDataToReduce[index])
                }

                const newVals = reducer({
                    data: dataToReduce,
                    context: context,
                });
                newValues.push(newVals);
            }
          }
        }
      
        const newShape = this.getDataShape().slice();
        newShape[axis] = newLabels.length;
        this.data = ndarray(newValues, newShape);
        this.setDimensionLabels(temporalDimensionToAggregate.name, newLabels);
    }

    parseTemporalExtent(extent) {
        if (extent.length !== 2) {
            throw new Error("Invalid temporal extent. Temporal extent must be an array of exactly two elements.");
        }

        if (extent[0] === null && extent[1] === null) {
            throw new Error("Invalid temporal extent. Only one of the boundaries can be null.");
        }

        const start = parse_rfc3339(extent[0]) || parse_rfc3339_time(extent[0]);
        const end = parse_rfc3339(extent[1]) || parse_rfc3339_time(extent[1]);

        if ((extent[0] !== null && !start) || (extent[1] !== null && !end)) {
            throw new Error("Invalid temporal extent. Boundary must be ISO date string or null.");
        }

        return {
            start: extent[0] === null ? null : start,
            end: extent[1] === null ? null : end
        }
    }

    removeDimension(dimension) {
        const idx = this.dimensions.findIndex(d => d.name === dimension);
        this.dimensions = this.dimensions.filter(d => d.name !== dimension);
        const newDataShape = this.data.shape;
        newDataShape.splice(idx, 1);
        this.data = ndarray(this.data.data, newDataShape)
    }

    addDimension(name, label, type) {
        this._addDimension(0)
        this.dimensions.unshift({
            name: name,
            labels: [label],
            type: type
        })
    }

    extendDimensionWithData(axis, dataToAdd) {
        const finalShape = this.getDataShape()

        let locationToInsert = 1;
        let elementsToInsertAtOnce = 1;
        for (let i = 0; i < finalShape.length; i++) {
            if (i < axis) {
                elementsToInsertAtOnce *= finalShape[i];
                continue
            }
            locationToInsert *= finalShape[i];
        }

        elementsToInsertAtOnce = dataToAdd.length / elementsToInsertAtOnce;
        const dataArr = this.data.data;

        if (axis === 0) {
            for (let i = 0; i < dataToAdd.length; i++) {
                dataArr.push(dataToAdd[i]);
            }
        } else {
            for (let i = 1; i <= dataToAdd.length / elementsToInsertAtOnce; i++) {
                for (let j = 0; j < elementsToInsertAtOnce; j++) {
                    dataArr.splice(
                        i * locationToInsert + (i - 1) * elementsToInsertAtOnce + j, 
                        0, 
                        dataToAdd[(i - 1) * elementsToInsertAtOnce + j]
                    );
                }
            }
        }

        finalShape[axis]++;
        this.data = ndarray(dataArr, finalShape)
    }

    // axis: integer, dimension axis
    // dataToAdd: array, values to insert in dimension.
    // locationInDimension: integer, offset from start of dimension, max length of dimension. Default 0.
    insertIntoDimension(axis, dataToAdd, locationInDimension = 0) {
        const newShape = this.getDataShape().slice()
        newShape[axis] += 1

        let newSize = 1;
        for (let dimSize of newShape) {
            newSize *= dimSize
        }

        const newData = ndarray(new Array(newSize), newShape)

        const minInd = locationInDimension;
        const maxInd = locationInDimension + 1
        const allCoords = this._iterateCoords(newShape.slice());
        let dataToAddInd = 0;

        for (let coord of allCoords) {
            if (coord[axis] === locationInDimension) {
                newData.set(...coord, dataToAdd[dataToAddInd])
                dataToAddInd++
            } else if (coord[axis] > locationInDimension) {
                coord[axis]--
                const value = this.data.get(...coord)
                coord[axis]++
                newData.set(...coord, value)
            } else {
                const value = this.data.get(...coord)
                newData.set(...coord, value)
            }
        }

        this.data = newData
    }

    setInDimension(axis, dataToSet, index) {
        const allCoords = this._iterateCoords(this.data.shape.slice());
        let dataToSetInd = 0;

        for (let coord of allCoords) {
            if (coord[axis] === index) {
                this.data.set(...coord, dataToSet[dataToSetInd])
                dataToSetInd++
            }
        }
    }

    clone() {
        const copy = new DataCube(ndarray(this.data.data.slice(), this.data.shape), this.bands_dimension_name, this.temporal_dimension_name)
        const newDimensions = []
        for (let dim of this.dimensions) {
            newDimensions.push({
                name: dim.name,
                labels: dim.labels.slice(),
                type: dim.type
            })
        }
        copy.dimensions = newDimensions
        return copy
    }

    flattenToArray() {
        if ((!this.data.shape || this.data.shape.length === 0) && this.data.data.length === 1) {
            // We have a scalar.
            return this.data.data[0]
        }
        return flattenToNativeArray(this.data)
    }

    encodeData() {
        const shape = this.getDataShape();
        const flattenedData = this.flattenToArray();
        return [...shape, ...flattenedData];
    }

    // reducer: function, accepts `data` (labeled array) and `context` (any)
    // dimension: string, name of one of the existing dimensions
    reduceByDimension(reducer, dimension, context) {
        const data = this.data
        const axis = this.dimensions.findIndex(e => e.name === dimension)
        const labels = this.dimensions[axis].labels
        const allCoords = this._iterateCoords(data.shape.slice(), [axis]) // get the generator, axis of the selected dimension is `null` (entire dimension is selected)
        const newValues = []

        for (let coord of allCoords) {
            const dataToReduce = convert_to_1d_array(data.pick.apply(data, coord)) // Convert selection to a native array
            dataToReduce.labels = labels // Add dimension labels to array
            const newVals = reducer({
                data: dataToReduce,
                context: context
            })
            newValues.push(newVals)
        }

        const newShape = data.shape.slice()
        newShape.splice(axis, 1) // The selected dimension is removed
        this.data = ndarray(newValues, newShape)
        this.dimensions.splice(axis, 1) // Remove dimension information
    }

    applyDimension(process, dimension, target_dimension, context) {
        const data = this.data;
        const axis = this.dimensions.findIndex(e => e.name === dimension);
        const labels = this.dimensions[axis].labels;
        const allCoords = this._iterateCoords(data.shape.slice(), [axis]) // get the generator, axis of the selected dimension is `null` (entire dimension is selected)
        const targetDimensionLabels = [];

        if (target_dimension) {
            if (this.getDimensionByName(target_dimension)) {
                throw new Error("Dimension `target_dimension` already exists and cannot replace dimension `dimension`.");
            }

            const dim = this.getDimensionByName(dimension);
            dim.name = target_dimension;
            dim.type = this.OTHER;

            for (let i = 0; i < data.shape[axis]; i++) {
                targetDimensionLabels.push(i);
            }
        }

        for (let coord of allCoords) {
            const dataToProcess = convert_to_1d_array(data.pick.apply(data, coord));
            dataToProcess.labels = target_dimension ? targetDimensionLabels : labels;
            this._setArrayAlongAxis(coord, axis, process({
                data: dataToProcess,
                context
            }));
        }
    }

    getDataShape() {
        return this.data.shape;
    }

    _setArrayAlongAxis(coord, axis, array) {
        for (let i = 0; i < array.length; i++) {
            const newCoord = coord.slice();
            newCoord[axis] = i;

            this.data.set(...newCoord, array[i]);
        }
    }

    _addDimension(axis) {
        // new dimension is added before the axis
        this.data.shape.splice(axis, 0, 1)
        this.data = ndarray(this.data.data, this.data.shape)
    }

    // axis: integer, index of the dimension to filter
    // coordArr: array of indices of the dimension to keep
    _filter(axis, coordArr) {
        const length = this.data.data.length
        const stride = this.data.stride[axis]
        const axisSize = this.data.shape[axis]
        const newData = []

        for (let i = 0; i < length; i++) {
            if (coordArr.includes(Math.floor(i / stride) % axisSize)) {
                newData.push(this.data.data[i])
            }
        }

        const newShape = this.data.shape
        newShape[axis] = coordArr.length
        this.data = ndarray(newData, newShape)
    }

    // process: function, accepts `data` (labeled array) and `context` (any)
    apply(process, context) {
        const allCoords = this._iterateCoords(this.data.shape)
        for (let coords of allCoords) {
            this.data.set(...coords, process({
                "x": this.data.get.apply(this.data, coords),
                context: context
            }))
        }
    }

    // Generator that visits all coordinates of array with `shape`, keeping nullAxes `null`
    // shape: sizes of dimensions
    // nullAxes: array with axes that should be kept null
    * _iterateCoords(shape, nullAxes = []) {
        const cumulatives = fill(shape.slice(), 0);
        const coords = shape.slice();
        for (let axis of nullAxes) {
            shape[axis] = 1
            coords[axis] = null
        }
        let total = 1;
        for (let d = shape.length - 1; d >= 0; d--) {
            cumulatives[d] = total;
            total *= shape[d];
        }
        for (let i = 0; i < total; i++) {
            for (let d = shape.length - 1; d >= 0; d--) {
                if (coords[d] === null) {
                    continue
                }
                coords[d] = Math.floor(i / cumulatives[d]) % shape[d];
            }
            yield coords
        }
    }

    _merge_matching_cube(cube2, overlap_resolver) {
        for (let i = 0; i < this.data.data.length; i++) {
            this.data.data[i] = overlap_resolver({
                x: this.data.data[i],
                y: cube2.data.data[i]
            })
        }
    }

    // Returns new DataCube with added dimensions `cubes` with labels `cube1` and `cube2`
    _join_cubes_in_big_cube(cube2) {
        const newShape = cube2.getDataShape()
        newShape.unshift(2)
        this.addDimension("cubes", "cube1", this.OTHER) 
        this.getDimensionByName("cubes").labels.push("cube2")
        this.data = ndarray(this.data.data.concat(cube2.data.data), newShape)
        return this
    }

    _merge_subcube(cube2, overlap_resolver) {
        const coord2 = cube2.getDataShape().slice()
        const indicesOfDimension = []

        for (let dimension2 of cube2.dimensions) {
            const ind = this.dimensions.findIndex(d => d.name === dimension2.name)
            indicesOfDimension.push(ind);
        }

        const allCoords = this._iterateCoords(this.data.shape);
        for (let coord of allCoords) {
            const value1 = this.data.get(...coord)
            for (let i = 0; i < indicesOfDimension.length; i++) {
                coord2[i] = coord[indicesOfDimension[i]]
            }
            const value2 = cube2.data.get(...coord2)
            this.data.set(...coord, overlap_resolver({
                x: value1,
                y: value2
            }))
        }
    }

    _merge_dimension_with_different_labels(cube2, dimension, dimensionAxis, overlap_resolver, dimensionOverlaps) {
        const axis = this.dimensions.findIndex((e) => e.name === dimension.name);

        if (dimensionOverlaps) {
            // Merge differing dimension with overlap
            for (let j = 0; j < dimension.labels.length; j++) {
                if (!this.dimensions[axis].labels.includes(dimension.labels[j])) {
                    // Label does not overlap
                    const coord = fill(cube2.data.shape.slice(), null)
                    coord[dimensionAxis] = j
                    const dataToInsert = flattenToNativeArray(cube2.data.pick(...coord))
                    this.insertIntoDimension(axis, dataToInsert, this.data.shape[axis])
                    this.dimensions[axis].labels.push(dimension.labels[j])
                    continue
                }
                const coord1 = fill(this.data.shape.slice(), null)
                const index1 = this.dimensions[axis].labels.indexOf(dimension.labels[j])
                coord1[axis] = index1
                const data1 = flattenToNativeArray(this.data.pick(...coord1))
                const coord2 = fill(cube2.data.shape.slice(), null)
                coord2[dimensionAxis] = j
                const data2 = flattenToNativeArray(cube2.data.pick(...coord2))

                for (let k = 0; k < data1.length; k++) {
                    data1[k] = overlap_resolver({
                        x: data1[k],
                        y: data2[k]
                    })
                }
                this.setInDimension(axis, data1, index1)

            }
        } else {
            const origSize = this.data.shape[axis]
            const coord = fill(cube2.getDataShape().slice(), null)

            for (let j = 0; j < dimension.labels.length; j++) {
                coord[dimensionAxis] = j
                const dataToInsert = flattenToNativeArray(cube2.data.pick(...coord))
                this.insertIntoDimension(axis, dataToInsert, origSize + j)
            }

            this.dimensions[axis].labels = this.dimensions[axis].labels.concat(dimension.labels)
        }
    }

    _checkLabelsEqual(labels1, labels2) {
        if (labels1.length !== labels2.length) {
            return false
        }
        const duplicatedLabelsError = new ProcessError({
            name: "Internal",
            message: "Dimension labels must be unique!"
        })
        const set1 = new Set(labels1)
        if (set1.size !== labels1.length) {
            throw duplicatedLabelsError
        }
        const set2 = new Set(labels2)
        if (set2.size !== labels2.length) {
            throw duplicatedLabelsError
        }
        for (let label of labels1) {
            if (!labels2.includes(label)) {
                return false
            }
        }
        return true
    }

    merge(cube2, overlap_resolver) {
        const cube1SpecificDimensions = []
        const cube2SpecificDimensions = []

        let dimensionWithDifferentLabels;
        let dimensionWithDifferentLabelsOverlaps = false;

        for (let dimension of this.dimensions) {
            const dimension2 = cube2.getDimensionByName(dimension.name);

            if (!dimension2) {
                cube1SpecificDimensions.push(dimension)
                continue
            } 

            const labelsEqual = this._checkLabelsEqual(dimension.labels, dimension2.labels)

            if (
                dimension.name === dimension2.name &&
                dimension.type === dimension2.type &&
                labelsEqual
            ) {
                continue;
            }


            if (labelsEqual) {
                throw new ProcessError({
                    name: "Internal",
                    message: "Shared dimensions have to have the same name and type in 'merge_cubes'."
                })
            }

            if (dimensionWithDifferentLabels) {
                throw new ProcessError({
                    name: "Internal",
                    message: "Only one of the dimensions can have different labels in 'merge_cubes'."
                })
            }

            dimensionWithDifferentLabels = dimension.name

            if (dimension.labels.some((l) => dimension2.labels.includes(l))) {
                dimensionWithDifferentLabelsOverlaps = true;
            }
        }

        for (let dimension2 of cube2.dimensions) {
            const dimension = this.getDimensionByName(dimension2.name);
            if (!dimension) {
                cube2SpecificDimensions.push(dimension2)
            }
        }

        const allDimensionsEqual = cube1SpecificDimensions.length === 0 && cube2SpecificDimensions.length === 0;

        if (!overlap_resolver && ((dimensionWithDifferentLabels && dimensionWithDifferentLabelsOverlaps))) {
            throw new ProcessError({
                name: "OverlapResolverMissing",
                message: "Overlapping data cubes, but no overlap resolver has been specified."
            });
        }

        if (allDimensionsEqual && !dimensionWithDifferentLabels && overlap_resolver) {
            return this._merge_matching_cube(cube2, overlap_resolver)
        }
        if (allDimensionsEqual && !dimensionWithDifferentLabels && !overlap_resolver) {
            return this._join_cubes_in_big_cube(cube2)
        }

        const isCube2Subcube = !dimensionWithDifferentLabels && cube2SpecificDimensions.length === 0 && cube1SpecificDimensions.length > 0;

        if (isCube2Subcube) {
            return this._merge_subcube(cube2, overlap_resolver)
        }

        const isCube1Subcube = !dimensionWithDifferentLabels && cube1SpecificDimensions.length === 0 && cube2SpecificDimensions.length > 0;

        if (isCube1Subcube) {
            cube2._merge_subcube(this, overlap_resolver)
            this.data = cube2.data;
            this.dimensions = cube2.dimensions
            return
        }

        for (let i = 0; i < cube2.dimensions.length; i++) {
            if (!this.getDimensionByName(cube2.dimensions[i].name)) {
                // Add dimension from cube2 missing from cube1
                this.dimensions.push(cube2.dimensions[i])
                this.data.shape.push(cube2.data.shape[i])
                continue
            }

            if (cube2.dimensions[i].name == dimensionWithDifferentLabels) {
                this._merge_dimension_with_different_labels(cube2, cube2.dimensions[i], i, overlap_resolver, dimensionWithDifferentLabelsOverlaps)
            }
        }
    }
}


	function reduce_dimension_fab1cb29f6d24295ad06007028dffa97(arguments) {

	function reduce_dimension(arguments) {
	    function reducer(arguments) {
    
			function mean_3b45e68b91ea43b99fef7a04b207ecc5(arguments) {
					function mean(arguments) {
					  const { data, ignore_nodata = true } = arguments;

					  validateParameter({
					    processName: "mean",
					    parameterName: "data",
					    value: data,
					    required: true,
					    array: true,
					  });

					  validateParameter({
					    processName: "mean",
					    parameterName: "ignore_nodata",
					    value: ignore_nodata,
					    nullable: false,
					    allowedTypes: ["boolean"],
					  });

					  let sum = 0;
					  let el_num = 0;

					  for (let x of data) {
					    validateParameter({
					      processName: "mean",
					      parameterName: "element of data",
					      value: x,
					      allowedTypes: ["number"],
					    });

					    if (x === null) {
					      if (ignore_nodata) {
					        continue;
					      } else {
					        return null;
					      }
					    }

					    sum += x;
					    el_num++;
					  }

					  if (el_num === 0) {
					    return null;
					  }

					  return sum / el_num;
					}

			    return mean(arguments)
			}

	    		let node_1 = mean_3b45e68b91ea43b99fef7a04b207ecc5({"data": arguments.data})
	        return node_1;
	    }

	    function reduce_dimension(arguments) {
	  const { data, dimension, reducer, context = null } = arguments;

	  validateParameter({
	    processName: "reduce_dimension",
	    parameterName: "data",
	    value: data,
	    nullable: false,
	    required: true,
	  });

	  validateParameter({
	    processName: "reduce_dimension",
	    parameterName: "dimension",
	    value: dimension,
	    nullable: false,
	    required: true,
	    allowedTypes: ["string"],
	  });

	  validateParameter({
	    processName: "reduce_dimension",
	    parameterName: "reducer",
	    value: reducer,
	    nullable: false,
	    required: true,
	  });

	  const newData = data.clone();
	  newData.reduceByDimension(reducer, dimension, context);
	  return newData;
	}

	    arguments['reducer'] = reducer;
	    return reduce_dimension(arguments);  
	}

	    return reduce_dimension(arguments)
	}

function evaluatePixel(samples, scenes) {
    let node_1 = new DataCube(samples, 'bands', 't', true, [], scenes)
    	let node_2 = reduce_dimension_fab1cb29f6d24295ad06007028dffa97({"data": node_1, "dimension": "t", "reducer": {"process_graph": {"1": {"process_id": "mean", "arguments": {"data": {"from_parameter": "data"}}, "result": true}}}})
    const finalOutput = node_2.flattenToArray()
    return Array.isArray(finalOutput) ? finalOutput : [finalOutput];
}

process.stdout.write(JSON.stringify(evaluatePixel([{"B01": 3, "B02": 3}, {"B01": 5, "B02": 1}], null)))
