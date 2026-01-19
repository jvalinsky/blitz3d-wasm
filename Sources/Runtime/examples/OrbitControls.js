/**
 * OrbitControls for Three.js r152
 * Standalone version compatible with global THREE object
 */

(function() {
    // Only add if THREE exists and doesn't already have OrbitControls
    if (typeof THREE === 'undefined') return;
    if (THREE.OrbitControls) return; // Already defined

    const _changeEvent = { type: 'change' };
    const _startEvent = { type: 'start' };
    const _endEvent = { type: 'end' };

    const _vector = new THREE.Vector3();
    const _quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
    const _quatInverse = _quat.clone().invert();
    const _lastPosition = new THREE.Vector3();
    const _lastQuaternion = new THREE.Quaternion();
    const _twoPI = 2 * Math.PI;

    THREE.OrbitControls = function(object, domElement) {
        this.object = object;
        this.domElement = domElement;
        this.domElement.style.touchAction = 'none';

        this.enabled = true;
        this.target = new THREE.Vector3();
        this.minDistance = 0;
        this.maxDistance = Infinity;
        this.minZoom = 0;
        this.maxZoom = Infinity;
        this.minPolarAngle = 0;
        this.maxPolarAngle = Math.PI;
        this.minAzimuthAngle = -Infinity;
        this.maxAzimuthAngle = Infinity;
        this.enableDamping = false;
        this.dampingFactor = 0.05;
        this.enableZoom = true;
        this.zoomSpeed = 1.0;
        this.enableRotate = true;
        this.rotateSpeed = 1.0;
        this.enablePan = true;
        this.panSpeed = 1.0;
        this.screenSpacePanning = true;
        this.keyPanSpeed = 7.0;
        this.autoRotate = false;
        this.autoRotateSpeed = 2.0;
        this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
        this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        this._domElementKeyEvents = null;

        const scope = this;
        const STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_PAN: 4, TOUCH_DOLLY_PAN: 5, TOUCH_DOLLY_ROTATE: 6 };
        let state = STATE.NONE;

        const EPS = 0.000001;
        const spherical = new THREE.Spherical();
        const sphericalDelta = new THREE.Spherical();
        let scale = 1;
        const panOffset = new THREE.Vector3();
        let zoomChanged = false;

        const rotateStart = new THREE.Vector2();
        const rotateEnd = new THREE.Vector2();
        const rotateDelta = new THREE.Vector2();
        const panStart = new THREE.Vector2();
        const panEnd = new THREE.Vector2();
        const panDelta = new THREE.Vector2();
        const dollyStart = new THREE.Vector2();
        const dollyEnd = new THREE.Vector2();
        const dollyDelta = new THREE.Vector2();
        const pointers = [];
        const pointerPositions = {};

        this.getPolarAngle = function() { return spherical.phi; };
        this.getAzimuthalAngle = function() { return spherical.theta; };
        this.getDistance = function() { return this.object.position.distanceTo(this.target); };

        this.saveState = function() { scope.target0.copy(scope.target); scope.position0.copy(scope.object.position); scope.zoom0 = scope.object.zoom; };
        this.reset = function() { scope.target.copy(scope.target0); scope.object.position.copy(scope.position0); scope.object.zoom = scope.zoom0; scope.object.updateProjectionMatrix(); scope.dispatchEvent({ type: 'change' }); scope.update(); state = STATE.NONE; };

        this.update = function() {
            const offset = new THREE.Vector3();
            const quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
            const quatInverse = quat.clone().invert();
            const position = scope.object.position;
            offset.copy(position).sub(scope.target);
            offset.applyQuaternion(quat);
            spherical.setFromVector3(offset);
            if (scope.autoRotate && state === STATE.NONE) rotateLeft(getAutoRotationAngle());
            if (scope.enableDamping) { spherical.theta += sphericalDelta.theta * scope.dampingFactor; spherical.phi += sphericalDelta.phi * scope.dampingFactor; } 
            else { spherical.theta += sphericalDelta.theta; spherical.phi += sphericalDelta.phi; }
            let min = scope.minAzimuthAngle, max = scope.maxAzimuthAngle;
            if (isFinite(min) && isFinite(max)) { if (min < -Math.PI) min += _twoPI; else if (min > Math.PI) min -= _twoPI; if (max < -Math.PI) max += _twoPI; else if (max > Math.PI) max -= _twoPI; if (min <= max) spherical.theta = Math.max(min, Math.min(max, spherical.theta)); else spherical.theta = (spherical.theta > (min + max) / 2) ? Math.max(min, spherical.theta) : Math.min(max, spherical.theta); }
            spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
            spherical.makeSafe();
            spherical.radius *= scale;
            spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));
            if (scope.enableDamping) scope.target.addScaledVector(panOffset, scope.dampingFactor);
            else scope.target.add(panOffset);
            offset.setFromSpherical(spherical);
            offset.applyQuaternion(quatInverse);
            position.copy(scope.target).add(offset);
            scope.object.lookAt(scope.target);
            if (scope.enableDamping) { sphericalDelta.theta *= (1 - scope.dampingFactor); sphericalDelta.phi *= (1 - scope.dampingFactor); panOffset.multiplyScalar(1 - scope.dampingFactor); }
            else { sphericalDelta.set(0, 0, 0); panOffset.set(0, 0, 0); }
            scale = 1;
            zoomChanged = false;
            if (sphericalDelta.theta < EPS && sphericalDelta.phi < EPS && panOffset.lengthSq() < EPS && Math.abs(scale - 1) < EPS) return false;
            scope.dispatchEvent(_changeEvent);
            return true;
        };

        function getAutoRotationAngle() { return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed; }
        function getZoomScale() { return Math.pow(0.95, scope.zoomSpeed); }

        function rotateLeft(angle) { sphericalDelta.theta -= angle; }
        function rotateUp(angle) { sphericalDelta.phi -= angle; }

        const panLeft = function() {
            const v = new THREE.Vector3();
            return function(distance, objectMatrix) { v.setFromMatrixColumn(objectMatrix, 0); v.multiplyScalar(-distance); panOffset.add(v); };
        }();
        const panUp = function() {
            const v = new THREE.Vector3();
            return function(distance, objectMatrix) { if (scope.screenSpacePanning) v.setFromMatrixColumn(objectMatrix, 1); else { v.setFromMatrixColumn(objectMatrix, 0); v.crossVectors(scope.object.up, v); } v.multiplyScalar(distance); panOffset.add(v); };
        }();
        const pan = function() {
            const offset = new THREE.Vector3();
            return function(deltaX, deltaY) { const element = scope.domElement; if (scope.object.isPerspectiveCamera) { const position = scope.object.position; offset.copy(position).sub(scope.target); let targetDistance = offset.length(); targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0); panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix); panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix); } else if (scope.object.isOrthographicCamera) { panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix); panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix); } };
        }();
        function dollyOut(dollyScale) { if (scope.object.isPerspectiveCamera) scale /= dollyScale; else if (scope.object.isOrthographicCamera) { scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale)); scope.object.updateProjectionMatrix(); zoomChanged = true; } }
        function dollyIn(dollyScale) { if (scope.object.isPerspectiveCamera) scale *= dollyScale; else if (scope.object.isOrthographicCamera) { scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale)); scope.object.updateProjectionMatrix(); zoomChanged = true; } }

        function handleMouseDownRotate(event) { rotateStart.set(event.clientX, event.clientY); }
        function handleMouseDownDolly(event) { dollyStart.set(event.clientX, event.clientY); }
        function handleMouseDownPan(event) { panStart.set(event.clientX, event.clientY); }
        function handleMouseMoveRotate(event) { rotateEnd.set(event.clientX, event.clientY); rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed); rotateLeft(2 * Math.PI * rotateDelta.x / scope.domElement.clientHeight); rotateUp(2 * Math.PI * rotateDelta.y / scope.domElement.clientHeight); rotateStart.copy(rotateEnd); scope.update(); }
        function handleMouseMoveDolly(event) { dollyEnd.set(event.clientX, event.clientY); dollyDelta.subVectors(dollyEnd, dollyStart); if (dollyDelta.y > 0) dollyOut(getZoomScale()); else if (dollyDelta.y < 0) dollyIn(getZoomScale()); dollyStart.copy(dollyEnd); scope.update(); }
        function handleMouseMovePan(event) { panEnd.set(event.clientX, event.clientY); panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed); pan(panDelta.x, panDelta.y); panStart.copy(panEnd); scope.update(); }
        function handleMouseWheel(event) { if (event.deltaY < 0) dollyIn(getZoomScale()); else if (event.deltaY > 0) dollyOut(getZoomScale()); scope.update(); }

        function onMouseDown(event) {
            if (scope.enabled === false) return;
            switch (event.which) {
                case 1: if (scope.enableRotate) { handleMouseDownRotate(event); state = STATE.ROTATE; } break;
                case 2: if (scope.enableZoom) { handleMouseDownDolly(event); state = STATE.DOLLY; } break;
                case 3: if (scope.enablePan) { handleMouseDownPan(event); state = STATE.PAN; } break;
            }
            if (state !== STATE.NONE) { document.addEventListener('mousemove', onMouseMove, false); document.addEventListener('mouseup', onMouseUp, false); scope.dispatchEvent(_startEvent); }
        }
        function onMouseMove(event) {
            if (scope.enabled === false) return;
            event.preventDefault();
            switch (state) {
                case STATE.ROTATE: if (scope.enableRotate) handleMouseMoveRotate(event); break;
                case STATE.DOLLY: if (scope.enableZoom) handleMouseMoveDolly(event); break;
                case STATE.PAN: if (scope.enablePan) handleMouseMovePan(event); break;
            }
        }
        function onMouseUp() { document.removeEventListener('mousemove', onMouseMove, false); document.removeEventListener('mouseup', onMouseUp, false); scope.dispatchEvent(_endEvent); state = STATE.NONE; }
        function onMouseWheel(event) { if (scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE) return; event.preventDefault(); event.stopPropagation(); scope.dispatchEvent(_startEvent()); handleMouseWheel(event); scope.dispatchEvent(_endEvent()); }

        function onTouchStart(event) {
            if (scope.enabled === false) return;
            event.preventDefault();
            switch (event.touches.length) {
                case 1: 
                    if (scope.enableRotate) { handleMouseDownRotate(event); state = STATE.TOUCH_ROTATE; } 
                    else if (scope.enablePan) { handleMouseDownPan(event); state = STATE.TOUCH_PAN; } 
                    break;
                case 2: 
                    if (scope.enableZoom && scope.enablePan) { handleMouseDownDolly(event); handleMouseDownPan(event); state = STATE.TOUCH_DOLLY_PAN; } 
                    else if (scope.enableZoom) { handleMouseDownDolly(event); state = STATE.TOUCH_DOLLY_ROTATE; } 
                    else if (scope.enablePan) { handleMouseDownPan(event); state = STATE.TOUCH_PAN; } 
                    break;
            }
            if (state !== STATE.NONE) scope.dispatchEvent(_startEvent);
        }
        function onTouchMove(event) {
            if (scope.enabled === false) return;
            event.preventDefault();
            event.stopPropagation();
            switch (state) {
                case STATE.TOUCH_ROTATE: if (scope.enableRotate) handleMouseMoveRotate(event); break;
                case STATE.TOUCH_PAN: if (scope.enablePan) handleMouseMovePan(event); break;
                case STATE.TOUCH_DOLLY_PAN: if (scope.enableZoom && scope.enablePan) { handleMouseMoveDolly(event); handleMouseMovePan(event); } break;
                case STATE.TOUCH_DOLLY_ROTATE: if (scope.enableZoom && scope.enableRotate) { handleMouseMoveDolly(event); handleMouseMoveRotate(event); } break;
            }
        }
        function onTouchEnd() { document.removeEventListener('touchmove', onTouchMove, false); document.removeEventListener('touchend', onTouchEnd, false); scope.dispatchEvent(_endEvent); state = STATE.NONE; }

        scope.domElement.addEventListener('contextmenu', function(e) { e.preventDefault(); }, false);
        scope.domElement.addEventListener('mousedown', onMouseDown, false);
        scope.domElement.addEventListener('wheel', onMouseWheel, { passive: false });
        scope.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
        scope.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
        scope.domElement.addEventListener('touchend', onTouchEnd, false);
        scope.domElement.addEventListener('touchcancel', onTouchEnd, false);

        this.dispose = function() { scope.domElement.removeEventListener('contextmenu', function(e) { e.preventDefault(); }, false); scope.domElement.removeEventListener('mousedown', onMouseDown, false); scope.domElement.removeEventListener('wheel', onMouseWheel, { passive: false }); scope.domElement.removeEventListener('touchstart', onTouchStart, { passive: false }); scope.domElement.removeEventListener('touchmove', onTouchMove, { passive: false }); scope.domElement.removeEventListener('touchend', onTouchEnd, false); scope.domElement.removeEventListener('touchcancel', onTouchEnd, false); document.removeEventListener('mousemove', onMouseMove, false); document.removeEventListener('mouseup', onMouseUp, false); };

        this.update();
    };

    THREE.OrbitControls.prototype = {
        constructor: THREE.OrbitControls,
        dispatchEvent: function(event) { if (this._listeners && this._listeners[event.type]) this._listeners[event.type].forEach(function(listener) { listener(event); }); },
        addEventListener: function(type, listener) { if (!this._listeners) this._listeners = {}; if (!this._listeners[type]) this._listeners[type] = []; this._listeners[type].push(listener); },
        removeEventListener: function(type, listener) { if (this._listeners && this._listeners[type]) { const index = this._listeners[type].indexOf(listener); if (index !== -1) this._listeners[type].splice(index, 1); } },
        dispose: function() { this.dispose(); }
    };

    // Copy over the EventDispatcher methods
    THREE.OrbitControls.prototype.dispatchEvent = THREE.EventDispatcher.prototype.dispatchEvent;
    THREE.OrbitControls.prototype.addEventListener = THREE.EventDispatcher.prototype.addEventListener;
    THREE.OrbitControls.prototype.removeEventListener = THREE.EventDispatcher.prototype.removeEventListener;
})();
