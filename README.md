This project shows how to export 4K resolution 360 Videos and Photos from inside of Three.js scenes.

The process is described in this blog post: https://medium.com/p/788226f2c75f

# Examples

[example 4k video from demo scene on YouTube ](https://www.youtube.com/watch?v=nsJS0_vms5c)

![Alt text](screencap2.jpg?raw=true "Inside of a 3D environment")

[example 4k test video on YouTube ](https://www.youtube.com/watch?v=GcY7f8EYEQg)

![Alt text](screencap.jpg?raw=true "Early Tests")

# How this works
Basically you take a cube camera, save it to equirectangular photo, and then stitch those together to make a video.  Add some metadata and voila! You can then post them to Facebook and Youtube.

I made some modifications to the [CCapture.js library](https://github.com/spite/ccapture.js/), where I added a CC360Encoder class that calls into an cubemap to equirectangular image capture library [from the same author](https://github.com/spite/THREE.CubemapToEquirectangular). I made modifications to that library also, where I prepare the cube camera data for the encoder with the preBlob class.  Finally, I was running into memory issues very quickly, so I re-implemented the broken batching in CCapture.js for .jpg sequences.

The app will capture a batch every N seconds, according to the autoSaveTime parameter.  Save and unarchive these .tar files, then use FFMPEG to stitch the images together.  See the post on Medium for more about metadata.

# Try Online

[demo scene](https://imgntn.github.io/j360/demo.html)

[simple tests](https://imgntn.github.io/j360/index.html)


# Example files

Clone the repository and serve its files using a webserver of your choice.


[index.html](index.html) contains simple test shapes.  moving the camera during capture has no effect.

[demo.html](demo.html) is hacked into a three.js demo scene.  moving the camera during capture will change the final shot.


# Use it yourself

Include the modified CCapture.js and CubeMapToEquirectangular.js libraries.  You'll need tar.js and download.js as well.  Which controls to include are up to you.

Instantiate a capturer.  Batches will download automatically every N seconds according to the autoSaveTime property.

```
// Create a capturer that exports Equirectangular 360 JPG images in a TAR file
var capturer360 = new CCapture({
    format: 'threesixty',
    display: true,
    autoSaveTime: 3,
});
```

Add a managed CubemapToEquirectangular camera when you setup your scene.

Here we use “4K” but you can also use “2K” or “1K” as resolutions.

```equiManaged = new CubemapToEquirectangular(renderer, true,"4K");```


Call the capture method at the end render loop, and give it your canvas.

```capturer360.capture(canvas); ```

These functions will start and stop the recording.

```
function startCapture360(event) {
    capturer360.start();
}

function stopCapture360(event) {
    capturer360.stop();
}
```

# Unarchive, Convert, and Add Metadata

Unarchive the .tar files to a single folder and then convert the whole folder of images into a movie with one FFMPEG command

```ffmpeg -i %07d.jpg video.mp4```

The “%07d” tells FFMPEG that there are 7 decimals before the “.jpg” extension in each filename. 

In tests of a 30 second capture, I've seen a 1.66GB folder of 4K 360 images compress into a single 3.12mb  4K 360 video.  A lot depends on how much movement there is in the scene, but the reductions are dramatic.

Then use the [Spatial Media Metadata Injector](https://github.com/google/spatial-media/releases) to add spatial metadata and upload.

## Build and Run

Install dependencies with `npm install` and start a development server:

```bash
npm run dev
```

Build the bundled assets:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run serve
```

# Contact
Get in touch with me on LinkedIn for custom 360 content or more versatile deployments of this software.  

https://www.linkedin.com/in/jamespollack
