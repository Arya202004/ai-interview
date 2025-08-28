import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock Web Speech API
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
  },
  writable: true,
})

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: class {
    constructor() {
      this.start = jest.fn()
      this.stop = jest.fn()
      this.abort = jest.fn()
      this.continuous = false
      this.interimResults = false
      this.lang = 'en-US'
      this.onstart = null
      this.onresult = null
      this.onerror = null
      this.onend = null
    }
  },
  writable: true,
})

// Mock Web Audio API
Object.defineProperty(window, 'AudioContext', {
  value: class {
    constructor() {
      this.createAnalyser = jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        fftSize: 2048,
        frequencyBinCount: 1024,
        getByteFrequencyData: jest.fn(),
        getByteTimeDomainData: jest.fn(),
      }))
      this.createMediaStreamSource = jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }))
      this.createOscillator = jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        frequency: { value: 440 },
      }))
      this.createGain = jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        gain: { value: 1 },
      }))
    }
  },
  writable: true,
})

// Mock MediaDevices API
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({
        getTracks: () => [
          {
            stop: jest.fn(),
            getSettings: () => ({}),
          },
        ],
      })
    ),
    enumerateDevices: jest.fn(() =>
      Promise.resolve([
        {
          deviceId: 'default',
          kind: 'audioinput',
          label: 'Default - Microphone',
        },
      ])
    ),
  },
  writable: true,
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock console methods in tests
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: componentWillReceiveProps has been renamed')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Global test utilities
global.testUtils = {
  // Mock 3D context
  mockWebGLContext: () => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === 'webgl' || type === 'webgl2') {
        return {
          createBuffer: jest.fn(),
          bindBuffer: jest.fn(),
          bufferData: jest.fn(),
          createShader: jest.fn(),
          shaderSource: jest.fn(),
          compileShader: jest.fn(),
          createProgram: jest.fn(),
          attachShader: jest.fn(),
          linkProgram: jest.fn(),
          useProgram: jest.fn(),
          getAttribLocation: jest.fn(),
          vertexAttribPointer: jest.fn(),
          enableVertexAttribArray: jest.fn(),
          drawArrays: jest.fn(),
          viewport: jest.fn(),
          clearColor: jest.fn(),
          clear: jest.fn(),
          getError: jest.fn(() => 0),
          getShaderParameter: jest.fn(() => true),
          getProgramParameter: jest.fn(() => true),
        }
      }
      return getContext.apply(this, arguments)
    }
  },

  // Mock Three.js
  mockThreeJS: () => {
    jest.mock('three', () => ({
      Scene: jest.fn(() => ({
        add: jest.fn(),
        remove: jest.fn(),
        traverse: jest.fn(),
      })),
      PerspectiveCamera: jest.fn(() => ({
        position: { set: jest.fn() },
        lookAt: jest.fn(),
      })),
      WebGLRenderer: jest.fn(() => ({
        setSize: jest.fn(),
        render: jest.fn(),
        dispose: jest.fn(),
      })),
      BoxGeometry: jest.fn(),
      MeshBasicMaterial: jest.fn(),
      Mesh: jest.fn(() => ({
        position: { set: jest.fn() },
        rotation: { set: jest.fn() },
        scale: { set: jest.fn() },
      })),
    }))
  },
}
