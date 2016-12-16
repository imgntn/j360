This project shows how to export 4K resolution 360 Videos and Photos from inside of Three.js scenes.

[Part of a process described in this blog post](https://medium.com/p/788226f2c75f)

# Examples
[example 4k video on YouTube ](https://www.youtube.com/watch?v=GcY7f8EYEQg)

![Alt text](screencap.jpg?raw=true "Optional Title")

[Try it in a browser -- you'll still have to add metadata for social media compatibility (see the blog post)](https://imgntn.github.io/j360/)


# Setup

The scene and capture code are in j360.js, and the libaries are all included in index.html.

index: simple test shapes.  moving the camera during capture has no effect.

demo: hacked into a three.js demo scene.  moving the camera during capture will affect the final shot.

# How this works
Basically you take a cube camera, save it to equirectangular photo, and then stitch those together to make a video.  Add some metadata and voila! You can then post them to Facebook and Youtube.

I made some modifications to the [CCapture.js library](https://github.com/spite/ccapture.js/), where I added a CC360Encoder class that calls into an cubemap to equirectangular image capture library [from the same author](https://github.com/spite/THREE.CubemapToEquirectangular). I made modifications to that library also, where I prepare the cube camera data for the encoder with the preBlob class.  Finally, I was running into memory issues very quickly, so I re-implemented batching in CCapture.js for the equirectangular .jpg sequences.
