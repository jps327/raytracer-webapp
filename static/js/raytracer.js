/**
 * Author: Juan Pablo Sarmiento
 * Date: January 2013
 * Description: RayTracer Library
 */

var RayTracer = (function() {

  // General useful stuff
  var EPSILON = 1e-6;

  var clamp = function(low, high, x) {
    if (x > high) {
      return high;
    } else if (x < low) {
      return low; 
    } else {
      return x;
    }
  };

  var degreesToRadians = function(deg) {
    return deg/180 * Math.PI;
  };

  var extendProperties = function(target, object) {
    for (var key in object) {
      target[key] = object[key];
    }
  };

  // checks if something is a number.
  // E.g. "3" returns true. "abc" returns false.
  var isNumber = function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  };

  // RayTracer Image class
  // (not to be confused with Javascript's built-in Image class)
  // Data structure holding the image information for a canvas element
  var RTImage = function(width, height) {
    this.width = width;
    this.height = height;
  };

  extendProperties(RTImage.prototype, {
    getWidth: function() {
      return this.width;
    },
    getHeight: function() {
      return this.height;
    },

    setCanvas: function(canvasID) {
      this.canvasElement = document.getElementById(canvasID);
      this.context = this.canvasElement.getContext('2d');
      this.width = this.canvasElement.width;
      this.height = this.canvasElement.height;
      this.imageData = this.context.createImageData(this.width, this.height);
      return this;
    },

    repaint: function() {
      this.context.putImageData(this.imageData, 0, 0);
      return this;
    },

    setPixel: function(x, y, color) {
      var i = (x + y*this.imageData.width)*4;
      this.imageData.data[i] = color.x*255;
      this.imageData.data[i+1] = color.y*255;
      this.imageData.data[i+2] = color.z*255;
      this.imageData.data[i+3] = 255; // alpha channel, 255=opaque
      return this;
    },
  });

  // Vector class
  var Vector = function(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  };

  // Vector static functions
  extendProperties(Vector, {
    dot: function(a, b) {
      return (a.x*b.x) + (a.y*b.y) + (a.z*b.z);
    },
    cross: function(a, b) {
      return new Vector(
        (a.y * b.z) - (a.z * b.y),
        (a.z * b.x) - (a.x * b.z),
        (a.x * b.y) - (a.y * b.x)
      );
    },
    clone: function(v) {
      return new Vector(v.x, v.y, v.z);
    }
  });

  // Vector class methods
  extendProperties(Vector.prototype, {
    get: function() {
      return { x: this.x, y: this.y, z: this.z };
    },
    set: function(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    },
    add: function(v) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    },
    sub: function(v) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    },

    dot: function(v) {
      return Vector.dot(this, v);
    },
    cross: function(v) {
      this.set(Vector.cross(this, v));
      return this;
    },

    negate: function() {
      this.x *= -1;
      this.y *= -1;
      this.z *= -1;
      return this;
    },
    scale: function(s) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    },
    pairwiseMul: function(v) {
      this.x *= v.x;
      this.y *= v.y;
      this.z *= v.z;
      return this;
    },

    length2: function() {
      return this.x*this.x + this.y*this.y + this.z*this.z;
    },
    length: function() {
      return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
    },
    normalize: function() {
      var len = this.length();
      this.x /= len;
      this.y /= len;
      this.z /= len;
      return this;
    },

    equals: function(v) {
      return this.x === v.x && this.y === v.y && this.z === v.z;
    },
  });

  // short hand creation of vectors
  var $V = function(v1, v2, v3) {
    if (arguments.length === 0) {
      return new Vector();
    } else if (arguments.length === 1) {
      if (typeof v1 === 'object') {
        return Vector.clone(v1);
      } else if (typeof v1 === 'number') {
        return new Vector(v1, v1, v1);
      }
    } else if (arguments.length === 3) {
      return new Vector(v1, v2, v3);
    } else {
      throw "$V not called with correct number of arguments";
    }
  };

  // Matrix class
  var Matrix = function() {
    this.m = []; // 2d array, holds 16 entries
    this.tempM = []; // temporary storage for matrix multiplication
    this.setIdentity();
  };

  extendProperties(Matrix.prototype, {
    // mat is a 2d 4x4 array
    set: function(mat) {
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
          this.m[i][j] = mat[i][j];
        }
      }
      return this;
    },

    setIdentity: function() {
      for (var i = 0; i < 4; i++) {
        if (!this.m[i]) {
          this.m[i] = [];
          this.tempM[i] = [];
        }
        for (var j = 0; j < 4; j++) {
          this.m[i][j] = (i === j) ? 1 : 0;
          this.tempM[i][j] = (i === j) ? 1 : 0;
        }
      }
      return this;
    },

    // Set this matrix to be a Camera-to-Frame matrix
    // u, v, w are the vectors of the frame
    // p is the origin of the frame
    setCtoF: function(u, v, w, p) {
      this.setIdentity();
      this.m[0][0] = u.x;
      this.m[0][1] = u.y;
      this.m[0][2] = u.z;
      this.m[1][0] = v.x;
      this.m[1][1] = v.y;
      this.m[1][2] = v.z;
      this.m[2][0] = w.x;
      this.m[2][1] = w.y;
      this.m[2][2] = w.z;

      var temp = this.rightMultiplyVector(p);
      this.m[0][3] = -temp.x;
      this.m[1][3] = -temp.y;
      this.m[2][3] = -temp.z;
      return this;
    },

    // Sets this matrix to be a Frame-to-Camera matrix.
    // u, v, w are the vectors of the frame
    // p is the origin of the frame
    setFtoC: function(u, v, w, p) {
      this.setIdentity();
      this.m[0][0] = u.x;
      this.m[0][1] = v.x;
      this.m[0][2] = w.x;
      this.m[0][3] = p.x;
      this.m[1][0] = u.y;
      this.m[1][1] = v.y;
      this.m[1][2] = w.y;
      this.m[1][3] = p.y;
      this.m[2][0] = u.z;
      this.m[2][1] = v.z;
      this.m[2][2] = w.z;
      this.m[2][3] = p.z;
      return this;
    },

    // Sets the current matrix to a rotation about the given axis.
    // angle is in degrees
    setRotate: function(angle, axis) {
      angle = angle * Math.PI/180;
      var u = $V(axis).normalize();
      var ua = [u.x, u.y, u.z];
      this.setIdentity();
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          this.m[i][j] = ua[i] * ua[j];
        }
      }

      var cosTheta = Math.cos(angle);
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          this.m[i][j] += cosTheta * ((i == j ? 1 : 0) - ua[i]*ua[j]);
        }
      }
      var sinTheta = Math.sin(angle);
      this.m[1][2] -= sinTheta * u.x;
      this.m[2][1] += sinTheta * u.x;
      this.m[2][0] -= sinTheta * u.y;
      this.m[0][2] += sinTheta * u.y;
      this.m[0][1] -= sinTheta * u.z;
      this.m[1][0] += sinTheta *u.z;
      return this;
    },

    setTranslate: function(v) {
      this.setIdentity();
      this.m[0][3] = v.x;
      this.m[1][3] = v.y;
      this.m[2][3] = v.z;
      return this;
    },

    setScale: function(v) {
      this.setIdentity();
      this.m[0][0] = v.x;
      this.m[1][1] = v.y;
      this.m[2][2] = v.z;
      return this;
    },

    // Sets thie matrix to be the left product of t and itself.
    // This = t*this (t is a Matrix object)
    leftCompose: function(t) {
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
          this.tempM[i][j] = 0;
          for (var k = 0; k < 4; k++) {
            this.tempM[i][j] += t.m[i][k] * this.m[k][j];
          }
        }
      }
      this.set(this.tempM);
      return this;
    },

    // Sets this matrix to be the right product of t and itself.
    // This = this*t (t is a Matrix object)
    rightCompose: function(t) {
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
          this.tempM[i][j] = 0;
          for (var k = 0; k < 4; k++) {
            this.tempM[i][j] += this.m[i][k] * t.m[k][j];
          }
        }
      }
      this.set(this.tempM);
      return this;
    },

    // Transform vector v by this matrix
    rightMultiplyVector: function(v) {
      var x = this.m[0][0] * v.x + this.m[0][1] * v.y + this.m[0][2] * v.z;
      var y = this.m[1][0] * v.x + this.m[1][1] * v.y + this.m[1][2] * v.z;
      var z = this.m[2][0] * v.x + this.m[2][1] * v.y + this.m[2][2] * v.z;
      return $V(x, y, z);
    },

    // Transform point p by this matrix
    rightMultiplyPoint: function(p) {
      var x = this.m[0][0]*p.x + this.m[0][1]*p.y + this.m[0][2]*p.z + this.m[0][3];
      var y = this.m[1][0]*p.x + this.m[1][1]*p.y + this.m[1][2]*p.z + this.m[1][3];
      var z = this.m[2][0]*p.x + this.m[2][1]*p.y + this.m[2][2]*p.z + this.m[2][3];
      var w = this.m[3][0]*p.x + this.m[3][1]*p.y + this.m[3][2]*p.z + this.m[3][3];
      return $V(x/w, y/w, z/w);
    },

    transpose: function() {
      for (var r = 0; r < 3; r++) {
        for (var c = r; c < 4; c++) {
          var temp = this.m[r][c];
          this.m[r][c] = this.m[c][r];
          this.m[c][r] = temp;
        }
      }
      return this;
    },

    invert: function() {
      // Use LU decomposition and backsubstitution
      var tmp = [];
      for (var i = 0, r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++, i++) {
          tmp[i] = this.m[r][c];
        }
      }

      // Calculate LU decomposition: is the matrix singular?
      var row_perm = [];
      var nonsingular = this.luDecomposition(tmp, row_perm);
      if (!nonsingular) {
        throw "Cannot invert a singular matrix.";
      }

      // Perform back substitution on the identity matrix
      var result = [];
      for (var i = 0; i < 16; i++) {
        result[i] = 0;
      }
      result[0] = 1;
      result[5] = 1;
      result[10] = 1;
      result[15] = 1;
      this.luBacksubstitution(tmp, row_perm, result);

      // set the result
      for (var i = 0, r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++, i++) {
          this.m[r][c] = result[i];
        }
      }
      return this;
    },


    // returns true if the matrix is nonsingular, false otherwise
    // Reference: Press, Flannery, Tuekolsky, Vetterling,
    //    _Numerical_Recipes_in_C_, Cambridge University, Press,
    //    1988, pp 40-45.
    luDecomposition: function(matrix0, row_perm) {
      var row_scale = [];
      // Determine implicit scaling information by looping over rows
      var ptr = 0;
      var rs = 0;
      var i = 4;
      // For each row
      while (i-- != 0) {
        var big = 0;
        // For each column, find the largest element in the row
        var j = 4;
        while (j-- != 0) {
          var temp = matrix0[ptr++];
          temp = Math.abs(temp);
          if (temp > big) {
            big = temp;
          }
        }

        // Is the matrix singular?
        if (big === 0) {
          return false;
        }
        row_scale[rs++] = 1 / big;
      }

      // For all columns, execute Crout's method
      var mtx = 0;
      for (var j = 0; j < 4; j++) {
        var k = 0;
        var target = 0;
        var p1 = 0;
        var p2 = 0;
        var sum = 0;
        // Determine elements of upper diagonal matrix U
        for (var i = 0; i < j; i++) {
          target = mtx + (4*i) + j;
          sum = matrix0[target];
          k = i;
          p1 = mtx + (4*i);
          p2 = mtx + j;
          while (k-- != 0) {
            sum -= matrix0[p1] * matrix0[p2];
            p1++;
            p2 += 4;
          }
          matrix0[target] = sum;
        }

        // Search for largest pivot element and calculate
        // intermediate elements of lower diagonal matrix L
        var big = 0;
        var imax = -1;
        for (var i = j; i < 4; i++) {
          target = mtx + (4*i) + j;
          sum = matrix0[target];
          k = j;
          p1 = mtx + (4*i);
          p2 = mtx + j;
          while (k-- != 0) {
            sum -= matrix0[p1] * matrix0[p2];
            p1++;
            p2 += 4;
          }
          matrix0[target] = sum;

          // Is this the best pivot so far?
          if ((temp = row_scale[i] * Math.abs(sum)) >= big) {
            big = temp;
            imax = i;
          }
        }

        if (imax < 0) {
          throw "Error in luDecomposition. imax should not be < 0";
        }

        // Is a row exchange necessary?
        if (j != imax) {
          // yes, exchange rows
          k = 4;
          p1 = mtx + (4*imax);
          p2 = mtx + (4*j);
          while (k-- != 0) {
            temp = matrix0[p1];
            matrix0[p1++] = matrix0[p2];
            matrix0[p2++] = temp;
          }

          // Record change in scale factor
          row_scale[imax] = row_scale[j];
        }

        // Record row permutation
        row_perm[j] = imax;

        // Is the matrix singular
        if (matrix0[(mtx + (4*j) + j)] === 0) {
          return false;
        }

        // Divide elements of lower diagonal matrix L by pivot
        if (j != (4-1)) {
          temp = 1 / (matrix0[(mtx + (4*j) + j)]);
          target = mtx + (4*(j+1)) + j;
          i = 3 - j;
          while (i-- != 0) {
            matrix0[target] *= temp;
            target += 4;
          }
        }
      }

      return true;
    },

    // Solves a set of linear equations.
    // The input parameters matrix1 and row_perm come from luDecomposition and
    // do not change here. This takes each column of matrix2 and treats it as
    // the right-hand side of the matrix equation Ax = LUx = b. The solution
    // vector replaces the original column of the matrix.
    //
    // Reference: Press, Flannery, Tuekolsky, Vetterling,
    //    _Numerical_Recipes_in_C_, Cambridge University, Press,
    //    1988, pp 44-45.
    luBacksubstitution: function(matrix1, row_perm, matrix2) {
      var rv = 0;
      var rp = 0; // row permutation
      // For each column vector of matrix2
      for (var k = 0; k < 4; k++) {
        var cv = k;
        var ii = -1;

        // Forward substitution
        for (var i = 0; i < 4; i++) {
          var ip = row_perm[rp+i];
          var sum = matrix2[cv+4*ip];
          matrix2[cv+4*ip] = matrix2[cv+4*i];
          if (ii >= 0) {
            rv = i*4;
            for (var j = ii; j <= i-1; j++) {
              sum -= matrix1[rv+j] * matrix2[cv+4*j];
            }
          } else if (sum != 0) {
            ii = i;
          }
          matrix2[cv+4*i] = sum;
        }

        // Backsubstitution
        rv = 3*4;
        matrix2[cv+4*3] /= matrix1[rv+3];

        rv -= 4;
        matrix2[cv+4*2] = (matrix2[cv+4*2] -
            matrix1[rv+3] * matrix2[cv+4*3]) / matrix1[rv+2];

        rv -= 4;
        matrix2[cv+4*1] = (matrix2[cv+4*1] -
            matrix1[rv+2] * matrix2[cv+4*2] -
            matrix1[rv+3] * matrix2[cv+4*3]) / matrix1[rv+1];

        rv -= 4;
        matrix2[cv+4*0] = (matrix2[cv+4*0] -
            matrix1[rv+1] * matrix2[cv+4*1] -
            matrix1[rv+2] * matrix2[cv+4*2] -
            matrix1[rv+3] * matrix2[cv+4*3]) / matrix1[rv+0];
      }
    },
  });

  // Color class (extends Vector)
  var Color = function(r, g, b) {
    this.x = r || 0;
    this.y = g || 0;
    this.z = b || 0;
  };

  Color.prototype = new Vector(); // Color extends Vector
  extendProperties(Color.prototype, {
    getR: function() { return this.x; },
    getG: function() { return this.y; },
    getB: function() { return this.z; },
    gammaCorrect: function(gamma) {
      var inverseGamma = 1 / gamma;
      this.x = Math.pow(this.x, inverseGamma);
      this.y = Math.pow(this.y, inverseGamma);
      this.z = Math.pow(this.z, inverseGamma);
      return this;
    },
    clampColor: function() {
      this.x = clamp(0, 1, this.x);
      this.y = clamp(0, 1, this.y);
      this.z = clamp(0, 1, this.z);
      return this;
    },
  });

  extendProperties(Color, {
    red: function() { return new Color(1, 0, 0); },
    green: function() { return new Color(0, 1, 0); },
    blue: function() { return new Color(0, 0, 1); },
    white: function() { return new Color(1, 1, 1); },
    black: function() { return new Color(0, 0, 0); },
    gray: function() { return new Color(0.5, 0.5, 0.5); },
    yellow: function() { return new Color(1, 1, 0); },
    background: function() { return new Color(0.02, 0.02, 0.02); },
    clone: function(c) { 
      if (typeof c.x === 'undefined' &&
        typeof c.y === 'undefined' &&
        typeof c.z === 'undefined') {
        return new Color(c.r, c.g, c.b);
      } else {
        return new Color(c.x, c.y, c.z);
      }
    },
  });

  // short hand creation of colors
  var $C = function(r, g, b) {
    if (arguments.length === 0) {
      return new Color();
    } else if (arguments.length === 1) {
      if (typeof r === 'object') {
        return Color.clone(r);
      }
    } else if (arguments.length === 3) {
      return new Color(r, g, b);
    } else {
      throw "$C not called with correct number of arguments";
    }
  };

  // Ray class
  // (rayStart and rayEnd are optional arguments)
  var Ray = function(origin, direction, rayStart, rayEnd) {
    this.origin = origin;
    this.direction = direction;
    this.start = !!rayStart ? rayStart : EPSILON;
    this.end = !!rayEnd ? rayEnd : Number.MAX_VALUE;
  };

  extendProperties(Ray, {
    clone: function(r) {
      return new Ray(r.origin, r.direction, r.start, r.end);
    },
  });

  extendProperties(Ray.prototype, {
    getPoint: function(t) {
      return $V(this.direction).scale(t).add(this.origin);
    },
    reflect: function(normal, point) {
      var a = 2 * Vector.dot(normal, this.direction);
      var tempNormal = $V(normal).scale(a);
      this.direction.sub(tempNormal).normalize();
      this.origin.set(point);
    },
    refract: function(normal, point, n1, n2) {
      var n = n1 / n2;
      var c1 = -1 * Vector.dot(normal, this.direction);
      var c2 = Math.sqrt(1 - n*n*(1 - c1*c1));
      var c3 = n*c1 - c2;
      var tempNormal = $V(normal).scale(c3);
      var tempDirection = $V(this.direction).scale(n);
      tempDirection.add(tempNormal).normalize();
      this.direction.set(tempDirection);
      this.origin.set(point);
    },
  });


  // Camera class
  // All arguments for Camera constructor have default values
  var Camera = function(
      eye,
      viewDir,
      up,
      projectionDistance,
      viewWidth,
      viewHeight) {
    this.eye = !!eye ? eye : new Vector(0, 0, 1);
    this.viewDir = !!viewDir ? viewDir : new Vector(0, 0, -1);
    this.up = !!up ? up : new Vector(0, 1, 0);
    this.projectionDistance = !!projectionDistance ? projectionDistance : 1;
    this.setViewWidth(!!viewWidth ? viewWidth : 1);
    this.setViewHeight(!!viewHeight ? viewHeight : 1);

    this.basisW = $V(this.viewDir).scale(-1).normalize();
    this.basisU = $V(this.up).cross(this.basisW).normalize();
    this.basisV = $V(this.basisW).cross(this.basisU).normalize();
  }

  extendProperties(Camera.prototype, {
    // generate a ray going from the camera through a point in the image
    // u = u coordinate of image in range [0, 1]
    // v = v coordinate of image in range [0, 1]
    genRayOfUV: function(u, v) {
      // s is the point on the image which our ray intersects
      var tempU = $V(this.basisU).scale(u);
      var tempV = $V(this.basisV).scale(v);
      var tempW = $V(this.basisW).scale(this.projectionDistance);
      var s = $V(this.eye).add(tempU).add(tempV).sub(tempW);
      
      var origin = $V(this.eye);
      var direction = $V(s).sub(this.eye).normalize();
      return new Ray(origin, direction);
    },

    setViewHeight: function(h) {
      this.viewHeight = h;
      this.b = -this.viewHeight / 2;
      this.t = this.viewHeight / 2;
    },

    setViewWidth: function(w) {
      this.viewWidth = w;
      this.l = -this.viewWidth / 2;
      this.r = this.viewWidth / 2;
    },
  });

  // Light class
  // light is represented by a position vector, and the intensity
  // of the light (which is represented as a color)
  var Light = function(position, intensity) {
    this.position = position;
    this.intensity = intensity;
  };

  extendProperties(Light, {
    // scale a color by a given light's intensity
    scaleColor: function(color, light) {
      return $C(
        color.getR() * light.getR(),
        color.getG() * light.getG(),
        color.getB() * light.getB()
      );
    },
  });

  // Intersection class
  // This represents a ray intersection with an object
  // t        t-value along the ray at which intersection occurred
  // point    the point of intersection
  // normal   the normal vector on the point of intersection
  // surface  the surface being intersected
  var Intersection = function(t, point, normal, surface) {
    this.t = t;
    this.point = point;
    this.normal = normal;
    this.surface = surface;
  };

  extendProperties(Intersection.prototype, {
    set: function(intersection) {
      this.t = intersection.t;
      this.point = intersection.point;
      this.normal = intersection.normal;
      this.surface = intersection.surface;
      this.texCoords = intersection.texCoords;
    },
    setT: function(tval) {
      this.t = tval;
    },
    setPoint: function(point) {
      this.point = point;
    },
    setNormal: function(normal) {
      this.normal = normal;
    },
    setSurface: function(surface) {
      this.surface = surface;
    },
    // set the texture coordinates of the point of intersection
    setTexCoords: function(texCoords) {
      this.texCoords = texCoords;
    },
    // get a vector pointing from the point of intersection to a
    // given light position
    getVectorToLight: function(light) {
      return $V(light.position).sub(this.point).normalize();
    },
  });

  // Surface class (base class for all surfaces, e.g. box, sphere)
  var Surface = function() {
    this.tMat = new Matrix(); // transformation matrix
    this.tMatInv = new Matrix(); // inverse of the transformation matrix
    this.tMatTInv = new Matrix(); // inverse of the transpose of the transformation matrix
    // TODO: add fields for bounding box
  };

  extendProperties(Surface.prototype, {
    setShader: function(shader) { // e.g. Lambertian, Phong, etc.
      this.shader = shader;
      return this;
    },
    getShader: function() {
      return this.shader;
    },

    setTransformation: function(a, aInv, aTInv) {
      this.tMat = a;
      this.tMatInv = aInv;
      this.tMatTInv = aTInv;
      // TODO: computeBoundingBox();
      return this;
    },

    // Untransform ray using tMatInv
    untransformRay: function(r) {
      var ray = Ray.clone(r);
      ray.direction = this.tMatInv.rightMultiplyVector(ray.direction);
      ray.origin = this.tMatInv.rightMultiplyPoint(ray.origin);
      return ray;
    },

    // Add this surface to the surfaces array. This array will be used
    // in the AABB tree construction.
    appendRenderableSurfaces: function(surfaces) {
      surfaces.push(this);
      return this;
    },
  });

  // Group class
  var Group = function() {
    this.objs = []; // list of surfaces under this group
    // the transformation matrix associated with this group
    this.transformMat = new Matrix();
  };

  Group.prototype = new Surface();
  extendProperties(Group, {
    tmp: new Matrix() // a shared temporary matrix
  });

  extendProperties(Group.prototype, {
    // Compute tMat, tMatInv, tMatTInv for this group and propagate
    // values to the childen under it
    setTransformation: function(cMat, cMatInv, cMatTInv) {
      // we apply the transformation from bottom-up the tree.
      // i.e. the child's transformation will be applied to
      // objects before its parent's
      this.tMat = new Matrix()
        .set(cMat.m)
        .rightCompose(this.transformMat);
      this.tMatInv = new Matrix()
        .set(this.tMat.m)
        .invert();
      this.tMatTInv = new Matrix()
        .set(this.tMatInv.m)
        .transpose();

      for (var i = 0; i < this.objs.length; i++) {
        this.objs[i].setTransformation(this.tMat, this.tMatInv, this.tMatTInv);
      }
      // TODO: computeBoundingBox();
      return this;
    },

    setTranslate: function(tVector) {
      Group.tmp.setTranslate(tVector);
      this.transformMat.rightCompose(Group.tmp);
      return this;
    },

    setRotate: function(rVector) {
      Group.tmp.setRotate(rVector.z, $V(0, 0, 1));
      this.transformMat.rightCompose(Group.tmp);
      Group.tmp.setRotate(rVector.y, $V(0, 1, 0));
      this.transformMat.rightCompose(Group.tmp);
      Group.tmp.setRotate(rVector.x, $V(1, 0, 0));
      this.transformMat.rightCompose(Group.tmp);
      return this;
    },

    setScale: function(sVector) {
      Group.tmp.setScale(sVector);
      this.transformMat.rightCompose(Group.tmp);
      return this;
    },

    addSurface: function(surface) {
      this.objs.push(surface);
      return this;
    },

    intersect: function(ray) {
      return null;
    },

    // TODO: computeBoundingBox: function() { }
    // override from Surface
    appendRenderableSurfaces: function(surfaces) {
      for (var i = 0; i < this.objs.length; i++) {
        this.objs[i].appendRenderableSurfaces(surfaces);
      }
      return this;
    },
  });

  // Sphere class
  var Sphere = function(data) {
    var data = data || {};
    this.center = data.center || $V();
    this.radius = data.radius || 1;
    this.shader = data.shader || new Lambertian();
  };

  Sphere.prototype = new Surface();
  extendProperties(Sphere.prototype, {
    setCenter: function(center) {
      this.center.set(center);
      return this;
    },
    setRadius: function(radius) {
      this.radius = radius;
      return this;
    },

    // Intersects the given ray with this sphere.
    // Returns an Intersection object, or null if there is no intersection.
    intersect: function(r) {
      var ray = this.untransformRay(r);
      var c = this.center.get();
      var s = ray.origin.get();
      var d = ray.direction.get();
      var r = this.radius;

      var A = d.x*d.x + d.y*d.y + d.z*d.z;
      var B = -2*c.x*d.x - 2*c.y*d.y - 2*c.z*d.z + 2*d.x*s.x + 2*d.y*s.y
        + 2*d.z*s.z;
      var C = c.x*c.x - 2*c.x*s.x + c.y*c.y - 2*c.y*s.y + c.z*c.z - 2*c.z*s.z
        + s.x*s.x + s.y*s.y + s.z*s.z - r*r;
      var disc = B*B - 4*A*C;

      if (disc < 0) {
        return null;
      }
      var t1 = (-B + Math.sqrt(disc)) / (2*A);
      var t2 = (-B - Math.sqrt(disc)) / (2*A);

      var getIntersection = (function(tval) {
        var point = ray.getPoint(tval); // point of intersection
        var normal = $V(point).sub(this.center).normalize();
        point = this.tMat.rightMultiplyPoint(point);
        normal = this.tMatTInv.rightMultiplyVector(normal).normalize();
        return new Intersection(tval, point, normal, this);
      }).bind(this);

      if ((t1 >= ray.start && t1 <= ray.end) &&
          (t2 >= ray.start && t2 <= ray.end)) {
        return getIntersection(Math.min(t1, t2));
      } else if (t1 >= ray.start && t1 <= ray.end) {
        return getIntersection(t1);
      } else if (t2 >= ray.start && t2 <= ray.end) {
        return getIntersection(t2);
      } else {
        return null;
      }
    },
    // TODO: computeBoundingBox: function() { }
  });

  var Box = function(data) {
    var data = data || {};
    this.minPt = data.minPt || $V();
    this.maxPt = data.maxPt || $V();
    this.shader = data.shader || new Lambertian();
  };

  Box.prototype = new Surface();
  extendProperties(Box.prototype, {
    setMinPt: function(minPt) {
      this.minPt = minPt;
      return this;
    },
    setMaxPt: function(maxPt) {
      this.maxPt = maxPt;
      return this;
    },

    // Intersects the given ray with this box.
    // Returns an Intersection object, or null if there is no intersection.
    intersect: function(r) {
      var ray = this.untransformRay(r);
      var p = ray.origin.get();
      var d = ray.direction.get();

      var ax = 1 / d.x;
      var ay = 1 / d.y;
      var az = 1 / d.z;

      var tx_min, tx_max, ty_min, ty_max, tz_min, tz_max;

      if (ax >= 0) {
        tx_min = ax*(this.minPt.x - p.x);
        tx_max = ax*(this.maxPt.x - p.x);
      } else {
        tx_min = ax*(this.maxPt.x - p.x);
        tx_max = ax*(this.minPt.x - p.x);
      }

      if (ay >= 0) {
        ty_min = ay*(this.minPt.y - p.y);
        ty_max = ay*(this.maxPt.y - p.y);
      } else {
        ty_min = ay*(this.maxPt.y - p.y);
        ty_max = ay*(this.minPt.y - p.y);
      }

      if (az >= 0) {
        tz_min = az*(this.minPt.z - p.z);
        tz_max = az*(this.maxPt.z - p.z);
      } else {
        tz_min = az*(this.maxPt.z - p.z);
        tz_max = az*(this.minPt.z - p.z);
      }

      if (tx_min > ty_max || ty_min > tx_max) {
        return null;
      } else if (tx_min > tz_max || tz_min > tx_max) {
        return null;
      } else if (ty_min > tz_max || tz_min > ty_max) {
        return null;
      } else {
        var getIntersection = (function(tval, normal) {
          var point = ray.getPoint(tval);
          point = this.tMat.rightMultiplyPoint(point);
          normal = this.tMatTInv.rightMultiplyVector(normal).normalize();
          return new Intersection(tval, point, normal, this);
        }).bind(this);

        var t_min = 0;
        var normal = $V();
        // Figure out which face we are intersecting, and update t
        if (tx_min > ty_min && tx_min > tz_min) {
          t_min = tx_min;
          normal.set($V(1, 0, 0));
        } else if (ty_min > tx_min && ty_min > tz_min) {
          t_min = ty_min;
          normal.set($V(0, 1, 0));
        } else if (tz_min > tx_min && tz_min > ty_min) {
          t_min = tz_min;
          normal.set($V(0, 0, 1));
        }
        if (t_min >= ray.start && t_min <= ray.end) {
          normal.normalize();
          return getIntersection(t_min, normal);
        } else {
          return null;
        }
      }

      // TODO: computeBoundingBox: function() { }
    },
  });

  // SurfaceList class
  // TODO: (change this to use an Axis-Aligned Bounding-Box data structure)
  var SurfaceList = function(surfaces) {
    this.surfaces = !!surfaces ? surfaces : [];
    this.left = 0;
    this.right = this.surfaces.length;
  };

  extendProperties(SurfaceList.prototype, {
    addSurface: function(surface) {
      this.surfaces.push(surface);
      this.right = this.surfaces.length;
      return this;
    },
    setSurfaces: function(surfaces) {
      this.surfaces = surfaces;
      this.right = this.surfaces.length;
      return this;
    },

    // returns the first intersection of a ray with a scene (the list of surfaces).
    // If 'useAny' is true then we just return the first intersection with any
    // object. If it is false then we return the closest intersection.
    getFirstIntersection: function(ray, useAny) {
      var newRay = new Ray(ray.origin, ray.direction, ray.start, ray.end);
      var intersectionResult = null;

      for (var i = this.left; i < this.right; i++) {
        var intersection = this.surfaces[i].intersect(newRay);
        if (!!intersection && intersection.t < newRay.end) {
          if (useAny) {
            return intersection;
          }
          newRay.end = intersection.t;
          if (!!intersectionResult) {
            intersectionResult.set(intersection);
          } else {
            intersectionResult = intersection;
          }
        }
      }
      return intersectionResult;
    },
    getClosestIntersection: function(ray) {
      return this.getFirstIntersection(ray, false);
    },
    getAnyIntersection: function(ray) {
      return this.getFirstIntersection(ray, true);
    },
  });

  // Scene class
  var Scene = function(width, height) {
    this.surfaceList = new SurfaceList();
    this.surfaces = [];
    this.lights = [];
    this.image = new RTImage(width, height);
  };

  extendProperties(Scene.prototype, {
    getImage: function() {
      return this.image;
    },
    setImageDimensions: function(width, height) {
      this.image.width = width;
      this.image.height = height;
      // dimensions were updated, so update the scene's camera
      if (this.camera) {
        this.setCamera(this.camera);
      }
      return this;
    },
    setImageCanvas: function(canvasID) {
      this.image.setCanvas(canvasID);
      if (this.camera) {
        this.setCamera(this.camera);
      }
      return this;
    },
    setCamera: function(camera) {
      this.camera = camera;
      if (this.image) {
        var width = this.image.getWidth();
        var height = this.image.getHeight();
        var aspect = width / height;
        if (width > height) {
          this.camera.setViewWidth(1);
          this.camera.setViewHeight(1 / aspect);
        } else {
          this.camera.setViewHeight(1);
          this.camera.setViewWidth(aspect);
        }
      }
      return this;
    },
    getCamera: function() {
      return this.camera;
    },
    addLight: function(light) {
      this.lights.push(light);
      return this;
    },
    getLights: function() {
      return this.lights;
    },

    setTransform: function() {
      var id = new Matrix().setIdentity();
      for (var i = 0; i < this.surfaces.length; i++) {
        this.surfaces[i].setTransformation(id, id, id);
      }
      return this;
    },

    // Initialize the AABB by retrieving a list of all surfaces from
    // the scene. Send the list to AABB and call createTree.
    // TODO: finish creating AABB
    initializeAABB: function() {
      var allSurfaces = [];
      for (var i = 0; i < this.surfaces.length; i++) {
        this.surfaces[i].appendRenderableSurfaces(allSurfaces);
      }
      this.surfaceList.setSurfaces(allSurfaces);
      // AABB.createTree(0, allSurfaces.length);
    },

    addSurface: function(surface) {
      this.surfaces.push(surface);
      return this;
    },
    getAnyIntersection: function(ray) {
      return this.surfaceList.getAnyIntersection(ray);
    },
    getFirstIntersection: function(ray) {
      return this.surfaceList.getFirstIntersection(ray);
    },
  });


  // Shader class (base class for all shaders, e.g. Lambertian, Phong)
  var Shader = function() { };
  extendProperties(Shader.prototype, {
    // check to see if a point we've intersected is being shadowed, that
    // way we know not to color it
    isShadowed: function(scene, light, intersection) {
      var pointOfIntersection = intersection.point;
      // create a shadow ray to start at the surface and end at light
      var ray = new Ray(
        pointOfIntersection,
        $V(light.position).sub(pointOfIntersection),
        EPSILON,
        1
      );
      return !!scene.getAnyIntersection(ray);
    },
  });

  // Lambertian class (extends Shader)
  var Lambertian = function(data) {
    var data = data || {};
    this.diffuseColor = data.diffuseColor || Color.white();
  };

  Lambertian.prototype = new Shader();
  extendProperties(Lambertian.prototype, {
    setDiffuseColor: function(color) {
      this.diffuseColor = color;
    },
    // Calculate the color at the given intersection.
    shade: function(scene, lights, toEye, intersection, data) {
      var c = $C();
      for (var i = 0; i < lights.length; i++) {
        var light = lights[i];
        if (!this.isShadowed(scene, light, intersection)) {
          // get light direction
          var l = $V(light.position).sub(intersection.point).normalize();
          // ld = kd*I*max(0, n.l)
          var ld = $C()
            .set(this.diffuseColor)
            .pairwiseMul(light.intensity)
            .scale(Math.max(0, intersection.normal.dot(l)));
          c.add(ld);
        }
      }
      return c;
    },
  });

  // Phong class (extends Shader)
  var Phong = function(data) {
    var data = data || {};
    this.diffuseColor = data.diffuseColor || Color.white();
    this.specularColor = data.specularColor || Color.white();
    this.exponent = data.exponent || 1;
  };
  Phong.prototype = new Shader();
  extendProperties(Phong.prototype, {
    setDiffuseColor: function(color) {
      this.diffuseColor = color;
    },
    setSpecularColor: function(color) {
      this.specularColor = color;
    },
    setExponent: function(exponent) {
      this.exponent = exponent;
    },

    shade: function(scene, lights, toEye, intersection, data) {
      var c = $C();
      for (var i = 0; i < lights.length; i++) {
        var light = lights[i];
        if (!this.isShadowed(scene, light, intersection)) {
          // get light direction
          var l = $V(light.position).sub(intersection.point).normalize();
          // get half-vector
          var h = $V(toEye).add(l).normalize();
          // get normal
          var n = intersection.normal;

          // calculate color
          var specular = $C(light.intensity)
            .pairwiseMul(this.specularColor)
            .scale(Math.pow(Math.max(0, h.dot(n)), this.exponent));
          var diffuse = $C(light.intensity)
            .pairwiseMul(this.diffuseColor)
            .scale(Math.max(0, n.dot(l)));
          c.add(specular).add(diffuse);
        }
      }

      return c;
    },
  });

  // Main Ray Tracing Functions

  // get the shaded color for a ray
  var shadeRay = function(scene, ray, data) {
    // TODO: implement recursive raytracing (for reflective materials)
    // find the first intersection of the ray with the scene
    var intersection = scene.getFirstIntersection(ray);
    if (!intersection) {
      // there is no intersection between ray and scene.
      return Color.background();
    }
    // compute toEye - a ray from the point of intersection going to the eye
    var toEye = $V(ray.origin).sub(intersection.point).normalize();
    return intersection.surface.getShader().shade(
      scene,
      scene.getLights(),
      toEye,
      intersection,
      data
    );
  };

  // Given a scene, and an (x, y) pixel, shoot a ray through this
  // pixel and return a color.
  var renderPixel = function(scene, x, y) {
    var image = scene.getImage();
    var cam = scene.getCamera(); 

    var l = cam.l;
    var r = cam.r;
    var b = cam.b;
    var t = cam.t;
    var nx = image.getWidth();
    var ny = image.getHeight();

    var u = l + ((r-l)*(x + 0.5))/nx;
    var v = b + ((t-b)*(y + 0.5))/ny;

    var ray = cam.genRayOfUV(u, v);
    var color = shadeRay(scene, ray, {});
    return color.gammaCorrect(2.2).clampColor();
  };

  var renderImage = function(scene) {
    var image = scene.getImage();
    var nx = image.getWidth();
    var ny = image.getHeight();

    for (var y = 0; y < ny; y++) {
      for (var x = 0; x < nx; x++) {
        var color = renderPixel(scene, x, y);
        image.setPixel(x, ny-y, color);
      }
    }
    image.repaint();
  };

  var basicLambertianScene = function() {
    return new Scene()
      .setCamera(new Camera())
      .addLight(new Light($V(-2, 3, 1), $C(1, 1, 1)))
      .addSurface(new Sphere({
        center: $V(0, 0, -5),
        radius: 1,
        shader: new Lambertian({ diffuseColor: $C(0.5, 0.5, 0.5) }),
      }));
  };

  var basicPhongScene = function() {
    return new Scene()
      .setCamera(new Camera())
      .addLight(new Light($V(-2, 3, 1), $C(1, 1, 1)))
      .addSurface(new Sphere({
        center: $V(0, 0, -5),
        radius: 1,
        shader: new Phong({
          diffuseColor: $C(0, 0, 1),
          specularColor: $C(0, 1, 1),
          exponent: 100
        }),
      }));
  };

  var basicBoxScene = function() {
    return new Scene()
      .setCamera(new Camera())
      .addLight(new Light($V(-2, 3, 1), $C(1, 1, 1)))
      .addSurface(new Box({
        minPt: $V(-2, -1.75, -9),
        maxPt: $V(-0.5, -0.5, -4.5),
        shader: new Lambertian({ diffuseColor: $C(0.5, 0.5, 0.5) })
      }));
  };

  var basicSphereTransformation = function() {
    return new Scene()
      .setCamera(new Camera())
      .addLight(new Light($V(0, 0, 0), $C(1, 1, 1)))
      .addSurface(new Group()
        .addSurface(new Sphere({
          center: $V(0, 0, 0),
          radius: 1,
          shader: new Phong({
            diffuseColor: $C(0, 0, 1),
            specularColor: $C(0, 1, 1),
            exponent: 100
          }),
        }))
        .setTranslate($V(0, 0, -5))
      );
  };

  var basicBoxTransformation = function() {
    return new Scene()
      .setCamera(new Camera())
      .addLight(new Light($V(0, 0, 0), $C(1, 1, 1)))
      .addSurface(new Group()
        .addSurface(new Box({
          minPt: $V(-1, -0.5, -3),
          maxPt: $V(1, 0.5, 3),
          shader: new Phong({
            diffuseColor: $C(0, 0, 1),
            specularColor: $C(0, 1, 1),
            exponent: 100
          }),
        }))
        .setTranslate($V(0.3, 0.3, -5))
        .setRotate($V(-5, 5, 10))
        .setScale($V(0.5))
      );
  };

  var sceneToRender = basicBoxTransformation;

  // Go through an entire JSON object and turn all numeric strings to
  // actual numbers
  var sanitizeNumericJSON = function(jsonObject) {
    for (var property in jsonObject) {
      if (jsonObject.hasOwnProperty(property)) {
        if (typeof jsonObject[property] === 'object') {
          sanitizeNumericJSON(jsonObject[property]);
        } else {
          var value = jsonObject[property];
          if (isNumber(value)) {
            jsonObject[property] = parseFloat(value);
          }
        }
      }
    }
  };

  // Go through an entire JSON object and turn all vectors and colors
  // to Vector and Color objects
  var sanitizeVectorJSON = function(jsonObject) {
    for (var property in jsonObject) {
      if (jsonObject.hasOwnProperty(property)) {
        if (typeof jsonObject[property] === 'object') {
          var obj = jsonObject[property];
          if (typeof obj.x !== 'undefined' &&
              typeof obj.y !== 'undefined' &&
              typeof obj.z !== 'undefined') {
            jsonObject[property] = $V(obj.x, obj.y, obj.z);
          } else if (typeof obj.r !== 'undefined' &&
              typeof obj.g !== 'undefined' &&
              typeof obj.b !== 'undefined') {
            jsonObject[property] = $C(obj.r, obj.g, obj.b);
          } else {
            sanitizeVectorJSON(obj);
          }
        }
      }
    }
  }

  // Given a JSON material representation, turn it into a RayTracer Shader
  var shaderFromJSON = function(jsonMat) {
    switch (jsonMat.type) {
      case 'lambertian':
        return new Lambertian(jsonMat);
      case 'phong':
        return new Phong(jsonMat);
      default:
        return new Lambertian();
    }
  };

  // Given a JSON surface representation, turn it into a RayTracer Surface
  var surfaceFromJSON = function(jsonSurface, shaders) {
    var surface = new Group();
    if (jsonSurface.type === 'group') {
      for (var i = 0; i < jsonSurface.objects.length; i++) {
        var jsonObject = jsonSurface.objects[i];
        // recursively turn each sub-object into a RayTracer Surface
        var subSurface = surfaceFromJSON(jsonObject, shaders);
        surface.addSurface(subSurface);
      }
    } else {
      jsonSurface.shader = shaders[jsonSurface.shader];
      switch (jsonSurface.type) {
        case 'sphere':
          surface.addSurface(new Sphere(jsonSurface));
          break;
        case 'box':
          surface.addSurface(new Box(jsonSurface));
          break;
        default:
          console.log("Invalid Surface Type: " + jsonSurface.type);
          return;
      }
    }
    surface
      .setTranslate($V(jsonSurface.translate))
      .setRotate($V(jsonSurface.rotate))
      .setScale($V(jsonSurface.scale));
    return surface;
  };

  // Given a JSON object representing a scene, turn it into a
  // renderable Scene object
  // JSON Scene needs: width, height, camera, lights list, materials map,
  // and objects list
  var createRenderableSceneFromJSON = function(jsonScene) {
    sanitizeNumericJSON(jsonScene);
    sanitizeVectorJSON(jsonScene);

    // get jsonScene properties
    var width = parseInt(jsonScene.width);
    var height = parseInt(jsonScene.height);
    var camera = jsonScene.camera;
    var lights = jsonScene.lights;
    var materials = jsonScene.materials;
    var objects = jsonScene.objects;

    // create new scene
    var scene = new Scene();

    // set its camera
    // TODO: change Camera to use data object instead of individual arguments
    scene.setCamera(new Camera(
        camera.eye,
        camera.viewDirection,
        camera.up,
        camera.projectionDistance,
        camera.viewWidth,
        camera.viewHeight
      )
    );

    // add lights to the scene
    for (var i = 0; i < lights.length; i++) {
      var light = lights[i];
      var intensity = light.intensity;
      var position = light.position;
      // TODO: change Light to use data object instead of individual arguments
      scene.addLight(new Light(position, intensity));
    }

    // turn json material map to new map of materialName -> RayTracer Material
    var shaders = {};
    for (var materialName in materials) {
      shaders[materialName] = shaderFromJSON(materials[materialName]);
    }

    // add surfaces to the scene
    for (var i = 0; i < objects.length; i++) {
      var surface = surfaceFromJSON(objects[i], shaders);
      scene.addSurface(surface);
    }

    scene
      .setImageDimensions(width, height)
      .setTransform()
      .initializeAABB(); // prepares scene for rendering
    return scene;
  };

  return {
    $V: $V,
    $C: $C,
    getSceneToRender: sceneToRender,
    renderPixel: renderPixel,
    renderImage: renderImage,
    createRenderableSceneFromJSON: createRenderableSceneFromJSON,
    createScene: function() {
      return new Scene();
    },
  };

})();
