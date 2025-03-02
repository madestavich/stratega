{
  spritesheets: {
    sptitesheet1: {
      sourceImage: {
        link: "link/to/image1.png";
        width: 100;
        height: 100;
      }
      animations: {
        idle: {
          frames: [
            { x: 0, y: 0, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            { x: 0, y: 10, width: 12, height: 10, frameCenter: { x: 6, y: 5 } },
            { x: 0, y: 22, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            {
              x: 10,
              y: 32,
              width: 10,
              height: 10,
              frameCenter: { x: 5, y: 5 },
            },
          ];
        }
        walk: {
          frames: [
            { x: 0, y: 0, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            { x: 0, y: 10, width: 12, height: 10, frameCenter: { x: 6, y: 5 } },
            { x: 0, y: 22, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            {
              x: 10,
              y: 32,
              width: 10,
              height: 10,
              frameCenter: { x: 5, y: 5 },
            },
          ];
        }
      }
    }
    spritesheet2: {
      sourceImage: {
        link: "link/to/image2.png";
        width: 100;
        height: 200;
      }
      animations: {
        run: {
          frames: [
            { x: 0, y: 0, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            { x: 0, y: 10, width: 12, height: 10, frameCenter: { x: 6, y: 5 } },
            { x: 0, y: 22, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            {
              x: 10,
              y: 32,
              width: 10,
              height: 10,
              frameCenter: { x: 5, y: 5 },
            },
          ];
        }
        swim: {
          frames: [
            { x: 0, y: 0, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            { x: 0, y: 10, width: 12, height: 10, frameCenter: { x: 6, y: 5 } },
            { x: 0, y: 22, width: 10, height: 10, frameCenter: { x: 5, y: 5 } },
            {
              x: 10,
              y: 32,
              width: 10,
              height: 10,
              frameCenter: { x: 5, y: 5 },
            },
          ];
        }
      }
    }
  }
}
