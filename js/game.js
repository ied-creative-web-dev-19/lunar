var Jumper = function() {};
Jumper.Play = function() {};

let platformIndex = 0;
const UNSTABLE_ASTEROIDS_SPAWN_THRESHOLD = 1;
let spawnAllowed = true;
let unstableAsteroidCollisionId = 0;

Jumper.Play.prototype = {

  preload: function() {
    this.load.image( 'hero', 'assets/astronauta.png' );
    this.load.image( 'pixel', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/836/pixel_1.png' );
    this.load.image( 'asteroide', 'assets/asteroide_nuova.png');
    this.load.image( 'razzo', 'assets/razzo_nuovo.png');
    this.load.image( 'bg', 'assets/sfondo.jpg');
    this.load.image( 'flame_asteroid', 'assets/asteroide_infuocata_nuovo.png');
    this.load.image( 'unstable_asteroid', 'assets/asteroide_nuova.png');
    this.load.image( 'aliens', 'assets/alieni_nuovo.png');
  },

  create: function() {
    // background color
    this.stage.backgroundColor = '#000';

    const bgWidth = this.game.width;
    const bgHeight = 1334 / 750 * this.game.width;
    this.bg = this.game.add.tileSprite(0, 0, bgWidth, bgHeight, 'bg');
    const bgScale = this.game.width / 750;
    this.bg.tileScale.set(bgScale, bgScale);

    // scaling
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    this.scale.maxWidth = this.game.width;
    this.scale.maxHeight = this.game.height;
    this.scale.pageAlignHorizontally = false;
    this.scale.pageAlignVertically = false;

    // physics
    this.physics.startSystem( Phaser.Physics.P2 );

    // camera and platform tracking vars
    this.cameraYMin = 99999;
    this.platformYMin = 99999;

    // create platforms
    this.platformsCreate();
    this.createRocketFloor();

    // create hero
    this.heroCreate();

    //
    this.isFirstJump = true;

    // create enemies
    this.flameAsteroids = this.game.add.group(); // create group
    this.aliens = this.game.add.group(); // create group
    this.game.time.events.add( 3000 , this.createNewEnemy, this);

    this.game.input.onTap.add(this.moveHeroByClick, this);
  },

  update: function() {

    // this is where the main magic happens
    // the y offset and the height of the world are adjusted
    // to match the highest point the hero has reached
    this.world.setBounds( 0, -this.hero.yChange, this.world.width, this.game.height + this.hero.yChange );

    // the built in camera follow methods won't work for our needs
    // this is a custom follow style that will not ever move down, it only moves up
    this.cameraYMin = Math.min( this.cameraYMin, this.hero.y - this.game.height + 130 );
    this.camera.y = this.cameraYMin;

    //keep the bg in sync
    if ( this.cameraYMin < 0 ) {
      this.bg.position.y = this.cameraYMin;
    }

    // hero collisions and movement
    this.physics.arcade.collide( this.hero, this.asteroids, this.checkUnstableAsteroidCollide, null, this );
    this.physics.arcade.collide( this.hero, this.rocket );
    this.physics.arcade.overlap( this.hero, this.flameAsteroids, this.checkEnemyTouch, null, this );
    this.physics.arcade.overlap( this.hero, this.aliens, this.checkEnemyTouch, null, this );
    this.heroMove();

    // asteroids killer
    this.flameAsteroids.forEachAlive( function(elem ) {
      if( elem.y > this.camera.y + this.game.height ) {
        elem.kill();
      }
    }, this );

    // alien killer
    this.aliens.forEachAlive( function(elem ) {
      if( elem.y > this.camera.y + this.game.height ) {
        elem.kill();
      }
    }, this );

    // for each plat form, find out which is the highest
    // if one goes below the camera view, then create a new one at a distance from the highest one
    // these are pooled so they are very performant

    this.asteroids.forEachAlive( function(elem ) {
      this.platformYMin = Math.min( this.platformYMin, elem.y );

      if( elem.y > this.camera.y + this.game.height + 100 ) {
        elem.kill();
        this.platformSpawn(this.platformYMin - 200 );
      }
    }, this );
  },

  platformsCreate: function() {
    // platform basic setup
    this.asteroids = this.add.group();
    this.asteroids.enableBody = true;
    this.asteroids.createMultiple( 10, 'asteroide');

    let howManyPlatform = Math.floor(this.world.height / 200) + 1;

    // create a batch of platforms that start to move up the level
    for( var i = 0; i < howManyPlatform; i++ ) {
      this.platformSpawn( this.world.height - 200 * ( i + 1 ) );
    }
  },

  platformSpawn: function(y) {
    let array = [this.world.width * 0.25 , this.world.width * 0.75];
    let index = platformIndex % 2;
    this.platformsCreateOne( array[index], y);
    platformIndex++;
  },

  platformsCreateOne: function( x, y ) {
    // this is a helper function since writing all of this out can get verbose elsewhere

    // check if it's needed to generate an unstable asteroid with minumum limit and randomly
    let generateUnstable = false;
    if ( UNSTABLE_ASTEROIDS_SPAWN_THRESHOLD <= platformIndex ) {
      let aRandomNumber = this.game.rnd.integerInRange(1, 2);
      if ( aRandomNumber % 2 === 0 ) {
        generateUnstable = true;
      }
    }

    var platform = this.asteroids.create(x, y, 'asteroide');

    if ( generateUnstable ){
      platform.loadTexture('unstable_asteroid');
    }

    this.game.physics.arcade.enable(platform);
    platform.enableBody = true;
    platform.anchor.set( 0.5 );
    platform.scale.x = 0.23; // asteroid its 595 x 595 px, so, 0.25 factor is 148.75 =~ 150
    platform.scale.y = 0.23;
    //platform.x -= 75;
    //platform.y -= 75;
    platform.body.immovable = true;
    platform.body.checkCollision.down = false;
    platform.body.checkCollision.up = true;
    platform.body.checkCollision.left = false;
    platform.body.checkCollision.right = false;

    return platform;
  },

  isColliding( elem1, elem2) {
    const distance = elem1.position.distance( elem2.position );
    const margin = 85;
    if ( distance < margin ) {
      return true;
    }
    return false;
  },

  checkUnstableAsteroidCollide(hero, unstableAsteroid) {
    if ( unstableAsteroid.key !== 'unstable_asteroid' ){
      return;
    }

    if ( !this.isColliding(hero, unstableAsteroid) ) {
      return;
    }

    // this check to execute code only on collision detected first time
    if ( unstableAsteroidCollisionId !== platformIndex ) {
      unstableAsteroidCollisionId = platformIndex;
      var that = this;
      let time = this.game.rnd.integerInRange(0, 3000); // genera un numero a caso tra 1000 e 9000
      console.log('xxx');
      setTimeout( function() {
        that.explodeUnstableAsteroid(unstableAsteroid, hero);
      } , 500 );
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async explodeUnstableAsteroid(unstableAsteroid, hero) {

    console.log(unstableAsteroid.position.y, this.cameraYMin, this.game.height,
        unstableAsteroid.position.x, this.game.width, unstableAsteroid.position.x);

    let isAway = false;
    if(
        unstableAsteroid.position.y - 30 > this.cameraYMin + this.game.height ||
        unstableAsteroid.position.x > this.game.width || unstableAsteroid.position.x < 0
    ) {
      isAway = true;
    }

    if ( !unstableAsteroid.alive || isAway ) {
      return;
    }

    unstableAsteroid.angle = 25;
    unstableAsteroid.position.x += 25;
    await this.sleep(300);
    unstableAsteroid.angle = -25;
    unstableAsteroid.position.x -= 25;
    await this.sleep(300);
    unstableAsteroid.angle = 25;
    unstableAsteroid.position.x += 25;
    await this.sleep(300);
    unstableAsteroid.angle = -25;
    unstableAsteroid.position.x -= 25;
    await this.sleep(300);
    unstableAsteroid.angle = 25;
    unstableAsteroid.position.x += 25;
    await this.sleep(300);
    unstableAsteroid.angle = -25;
    unstableAsteroid.position.x -= 25;
    await this.sleep(300);

    var emitter = game.add.emitter(unstableAsteroid.position.x, unstableAsteroid.position.y, 60);
    emitter.makeParticles('pixel', [0, 1, 2, 3, 4, 5]);
    emitter.minParticleSpeed.setTo(-400, -400);
    emitter.maxParticleSpeed.setTo(400, 400);
    emitter.gravity = 0;
    emitter.setScale(20,30,20,30,0,null,true);
    emitter.start(false, 4000, 15);

    setTimeout ( function () {
      emitter.on = false;
    }, 2000 );

    unstableAsteroid.destroy();

    if ( !this.isColliding(hero, unstableAsteroid) ){
      return;
    }

    this.hero.enableBody = false;
    this.hero.body.checkCollision.down = false;
    this.hero.body.checkCollision.down = false;
    this.hero.body.checkCollision.down = false;
    this.hero.body.checkCollision.down = false;

    let yExplosionHero = this.game.rnd.integerInRange(-400, 400);
    let xExplosionHero = this.game.rnd.integerInRange(-400, 400);
    this.hero.body.velocity.y = yExplosionHero;
    this.hero.body.velocity.x = xExplosionHero;
  },

  createRocketFloor() {
    this.rocket = this.game.add.sprite( 200, 200, 'razzo' );
    y = this.world.height + 53.2;
    x = this.world.width / 2.65;
    this.rocket.reset( x, y );
    this.rocket.scale.x = 0.17;
    this.rocket.scale.y = 0.17;
    this.rocket.anchor.set( 0.5 );

    this.game.physics.arcade.enable(this.rocket);
    this.rocket.enableBody = true;
    this.rocket.immovable = true;
    this.rocket.body.immovable = true;
    this.rocket.body.checkCollision.down = true;
    this.rocket.body.checkCollision.up = true;
    this.rocket.body.checkCollision.left = true;
    this.rocket.body.checkCollision.right = true;
  },

  heroCreate: function() {
    // basic hero setup
    this.hero = this.game.add.sprite( this.world.centerX, this.world.height - 80, 'hero' );
    this.hero.scale.setTo(0.15, 0.15);
    this.hero.anchor.set( 0.5 );

    // track where the hero started and how much the distance has changed from that point
    this.hero.yOrig = this.hero.y;
    this.hero.yChange = 0;

    // hero collision setup
    // disable all collisions except for down
    this.game.physics.arcade.enable(this.hero);
    this.hero.body.gravity.y = 500;
    this.hero.body.checkCollision.up = true;
    this.hero.body.checkCollision.down = true;
    this.hero.body.checkCollision.left = true;
    this.hero.body.checkCollision.right = true;
  },

  moveHeroByClick: function() {
    if( !this.hero.body.touching.down ) {
      return;
    }

    let jumpVelocities = this.getJumpVelocitiesForNextPlatform();
    console.log(jumpVelocities);
    this.hero.body.velocity.y = jumpVelocities[1];
    if ( this.game.input.activePointer.x > this.game.width/2 && jumpVelocities[0] > 0 || this.game.input.activePointer.x < this.game.width/2 && jumpVelocities[0] < 0 ){
      this.hero.body.velocity.x = jumpVelocities[0];
    } else {
      this.hero.body.velocity.x = -jumpVelocities[0];
    }
  },

  getJumpVelocitiesForNextPlatform: function() {
    const jumpVelocities = [1, 1];

    const heroX = this.hero.position.x;
    const heroY = this.hero.position.y;
    let lowerPlatformX = Number.MIN_SAFE_INTEGER;
    let lowerPlatformY = Number.MIN_SAFE_INTEGER;
    this.asteroids.forEachAlive((platform) => {
      console.log('platforms order (y):', platform.position.y, '(x):', platform.position.x);
      // if platform is lower than the player, ignore it
      if ( platform.position.y > heroY ) {
        return;
      }
      if ( platform.position.y > lowerPlatformY ) {
        lowerPlatformY = platform.position.y;
        lowerPlatformX =  platform.position.x;
      }
    });

    console.log('hero position: ', heroX, heroY);
    console.log('next platform position: ', lowerPlatformX, lowerPlatformY);

    // calculate parabole velocities
    let xVelocity = ( Math.abs(heroX) - Math.abs(lowerPlatformX) ) * 0.7;
    let yJumpMultiplier = 4.3;
    if ( this.isFirstJump ) {
      this.isFirstJump = false;
      yJumpMultiplier = 3.6;
    }
    let yVelocity = - Math.abs( heroY - lowerPlatformY ) * yJumpMultiplier;

    jumpVelocities[0] = xVelocity;
    jumpVelocities[1] = yVelocity;

    return jumpVelocities;
  },

  heroMove: function() {

    if ( this.hero.body.touching.down ) {
      this.hero.body.velocity.x = 0;
    }

    // wrap world coordinated so that you can warp from left to right and right to left
    // this.world.wrap( this.hero, this.hero.width / 2, false );

    // track the maximum amount that the hero has travelled
    this.hero.yChange = Math.max( this.hero.yChange, Math.abs( this.hero.y - this.hero.yOrig ) );

    // if the hero falls below the camera view, gameover
    if( this.hero.y > this.cameraYMin + this.game.height && this.hero.alive ) {
      this.state.start( 'Play' );
    }

    // if the hero falls aside, gameover
    if( this.hero.alive && ( this.hero.x > this.game.width || this.hero.x < 0 ) ) {
      this.state.start( 'Play' );
    }

  },

  createNewEnemy() {
    console.log('createNewEnemy',this.game.width - 100, this.cameraYMin - 100);
    if (spawnAllowed) {
      if ( this.game.rnd.integerInRange(1, 4) % 2 == 0 ) {
        this.spawnFlameAsteroid();
      } else {
        this.spawnAlien();
      }
      this.queueEnemy( this.game.rnd.integerInRange(2500, 4700) ); // call enemy queue for random between 2.5 and 5 seconds
    }
  },

  queueEnemy(time) {
    this.game.time.events.add(time, this.createNewEnemy, this); // add a timer that gets called once, then auto disposes to create a new enemy after the time given
  },

  spawnFlameAsteroid: function() {

    let aRandomNumber = this.game.rnd.integerInRange(1000, 1500); // genera un numero a caso tra 1000 e 9000

    let asteroid = this.flameAsteroids.create( this.game.width - 1, this.cameraYMin + 300, 'flame_asteroid');
    asteroid.scale.x = 0.03;
    asteroid.scale.y = 0.03;
    asteroid.anchor.set( 0.5 );

    this.game.physics.arcade.enable(asteroid);
    asteroid.enableBody = true;
    asteroid.immovable = false;
    asteroid.body.immovable = false;
    asteroid.body.checkCollision.down = true;
    asteroid.body.checkCollision.up = true;
    asteroid.body.checkCollision.left = true;
    asteroid.body.checkCollision.right = true;

    asteroid.body.velocity.x = -100;
    asteroid.body.velocity.y = 30;
  },

  spawnAlien: function() {

    let aRandomNumber = this.game.rnd.integerInRange(1000, 9000);

    let alien = this.aliens.create( this.game.width - 1, this.cameraYMin + 400, 'aliens');
    alien.scale.x = 0.03;
    alien.scale.y = 0.03;
    alien.anchor.set( 0.5 );

    this.game.physics.arcade.enable(alien);
    alien.enableBody = true;
    alien.immovable = false;
    alien.body.immovable = false;
    alien.body.checkCollision.down = true;
    alien.body.checkCollision.up = true;
    alien.body.checkCollision.left = true;
    alien.body.checkCollision.right = true;

    alien.body.velocity.x = -80;
    alien.body.velocity.y = 40;
  },

  checkEnemyTouch: function(hero, enemy){
    console.log('checkEnemyTouch');
    if ( !this.isDying ){

      var emitter = game.add.emitter(hero.position.x, hero.position.y, 250);
      emitter.makeParticles('pixel', [0, 1, 2, 3, 4, 5]);
      emitter.minParticleSpeed.setTo(-400, -400);
      emitter.maxParticleSpeed.setTo(400, 400);
      emitter.gravity = 0;
      emitter.start(false, 4000, 15);

      this.isDying = true;
      hero.enableBody = false;
      hero.body.immovable = false;
      hero.immovable = false;
      hero.body.checkCollision.down = false;
      hero.body.checkCollision.up = false;
      hero.body.checkCollision.left = false;
      hero.body.checkCollision.right = false;

      hero.body.velocity.x = enemy.body.velocity.x;
      hero.body.velocity.y = enemy.body.velocity.y;

      setTimeout( this.playerDie, 1000 );
    }
  },

  playerDie: function() {
    this.shutdown();
    this.state.start( 'Play' );
  },

  shutdown: function() {
    // reset everything, or the world will be messed up
    this.world.setBounds( 0, 0, this.game.width, this.game.height );
    this.hero.body.velocity.y = 0;
    this.hero.destroy();
    this.hero = null;
    this.asteroids.destroy();
    this.asteroids = null;
    this.rocket.destroy();
    this.rocket = null;
    this.aliens.destroy();
    this.aliens = null;
    this.flameAsteroids.destroy();
    this.flameAsteroids = null;
    this.isDying = false;
    platformIndex = 0;
    unstableAsteroidCollisionId = 0;
  },
}

var height = document.getElementById("game-container").offsetHeight;
var width = document.getElementById("game-container").offsetWidth;


var game = new Phaser.Game( width, height,Phaser.CANVAS, 'game-container' );
game.state.add( 'Play', Jumper.Play );
game.state.start( 'Play' );
