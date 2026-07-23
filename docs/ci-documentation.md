# GitHub Actions CI/CD Pipeline Documentation

## Overview

This repository uses a comprehensive GitHub Actions CI/CD pipeline designed
specifically for the Blitz3D-WASM project, which involves both Swift (compiler)
and Deno (runtime/testing) components.

## Pipeline Structure

### Main CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

**Jobs Overview:**

#### 1. Swift Tests (`swift-tests`)

- **Platforms:** Ubuntu and macOS
- **Swift Versions:** 5.9, 5.10 (matrix strategy)
- **Steps:**
  - Setup specific Swift version using `swift-actions/setup-swift@v2`
  - Cache Swift build artifacts for faster builds
  - Build release configuration (`swift build -c release`)
  - Run tests with code coverage (`swift test --enable-code-coverage`)
  - Generate and upload coverage reports to Codecov

#### 2. Deno/TypeScript Tests (`deno-tests`)

- **Platform:** Ubuntu latest
- **Steps:**
  - Setup Deno using `denoland/setup-deno@v2`
  - Cache Deno dependencies (`~/.cache/deno`)
  - Code quality checks:
    - `deno fmt --check` (formatting)
    - `deno lint` (linting)
    - `deno check **/*.ts` (type checking)
  - Run unit tests (`deno task test:deno`)
  - Generate and upload coverage reports
  - Run memory leak detection tests:
    - Static analysis scan (`deno task memleak:scan`)
    - Headless runtime leak check
    - WASM-specific leak tests (if WASM available)

#### 3. Web Build Tests (`web-build-tests`)

- **Purpose:** Test the web frontend build process
- **Steps:**
  - Setup Deno
  - Build web project (`deno task web:build`)
  - Run build validation tests (`deno task test:web:build`)
  - Upload build artifacts for later use

**Note (2026-02-02):** `web/deno.json` now pins Vite and ensures `three` is
prefetched via `deno task web:setup`. If you still hit a “cannot resolve
`three`” error, rerun `deno task web:setup` (or wipe `web/node_modules/` and
rerun). Offline/restricted environments can still serve `web/public/*.html`
demos without the Vite pipeline. See `docs/GETTING_STARTED.md`.

#### 4. Browser WASM Tests (`browser-tests`)

- **Purpose:** Test WASM compilation and browser execution
- **Steps:**
  - Setup Node.js for Puppeteer (headless browser testing)
  - Build Swift compiler
  - Compile test WASM files
  - Run browser-based tests using Puppeteer
  - Archive test results and screenshots

#### 5. Security Scan (`security-scan`)

- **Purpose:** Security vulnerability detection
- **Steps:**
  - Run Trivy vulnerability scanner
  - Upload results to GitHub Security tab
  - Check for hardcoded secrets using TruffleHog

#### 6. Performance Regression Tests (`performance-tests`)

- **Purpose:** Detect performance regressions on main branch
- **Triggers:** Only on pushes to main branch
- **Steps:**
  - Run WebGPU performance tests (if GPU available)
  - Run memory leak performance tests
  - Store performance metrics for trend analysis

#### 7. Cross-Platform Integration Tests (`integration-tests`)

- **Platforms:** Ubuntu and macOS
- **Purpose:** Comprehensive integration testing across platforms
- **Steps:**
  - Run all tests (`deno task test:all`)
  - Validate WASM output and instantiation
  - Cross-platform compatibility verification

#### 8. Test Summary (`test-summary`)

- **Purpose:** Consolidate all test results
- **Steps:**
  - Download all job artifacts
  - Generate comprehensive test summary in GitHub UI
  - Upload combined coverage reports

### Nightly Pipeline (`.github/workflows/nightly-tests.yml`)

**Triggers:**

- Scheduled: Daily at 2 AM UTC
- Manual: Via workflow dispatch

**Jobs:**

#### 1. Extended Performance Benchmarks

- **Purpose:** Deep performance analysis with extended test cycles
- **Tests:**
  - Extended memory leak tests (10 cycles, higher thresholds)
  - WebGPU extended tests (100 iterations, strict queue validation)
  - SCPCB churn tests (5000 steps, comprehensive monitoring)

#### 2. Cross-Platform Compatibility

- **Platforms:** Ubuntu, macOS, Windows
- **Purpose:** Ensure compatibility across all major platforms
- **Tests:** Full Deno test suite + Swift where available

#### 3. Security Monitoring

- **Purpose:** Ongoing security vigilance
- **Tests:**
  - Dependency security audits
  - CodeQL static analysis
  - Secret scanning in recent commits

#### 4. Performance Regression Detection

- **Purpose:** Automated performance regression detection
- **Method:**
  - Compare current performance with historical baselines
  - Alert on significant performance degradation
  - Store results for trend analysis

## Caching Strategy

### Swift Build Cache

```yaml
path: |
  .build
  ~/.cache
key: ${{ runner.os }}-swift-${{ matrix.swift-version }}-${{ env.CACHE_VERSION }}-${{ hashFiles('**/Package.resolved') }}
```

### Deno Dependencies Cache

```yaml
path: |
  ~/.cache/deno
  deno.lock
key: ${{ runner.os }}-deno-${{ env.CACHE_VERSION }}-${{ hashFiles('deno.lock', 'import_map.json') }}
```

## Security Considerations

### Permissions

- All Deno commands use minimal required permissions:
  - `--allow-read`: For file access
  - `--allow-write=/tmp`: For temporary test files
  - `--allow-run=deno`: For subprocess execution
  - `--allow-net`: For network operations (security scanning)

### Dependency Security

- Regular vulnerability scanning using Trivy
- CodeQL static analysis for security vulnerabilities
- Secret detection using TruffleHog
- Automated dependency review workflows

## Performance Optimizations

### Parallel Execution

- Independent jobs run in parallel to reduce total CI time
- Matrix strategies for testing multiple configurations simultaneously

### Intelligent Caching

- Multi-level caching (Deno, Swift, npm)
- Cache invalidation based on content hashes
- Optimized cache keys for better hit rates

### Resource Optimization

- Minimal Docker images for faster startup
- Selective artifact uploads to reduce storage
- Conditional job execution based on event types

## Monitoring and Alerting

### Test Results

- Real-time GitHub UI integration with job status badges
- Comprehensive test summaries with pass/fail indicators
- Coverage reports integrated with Codecov

### Performance Monitoring

- Automated regression detection with configurable thresholds
- Historical performance data retention
- Trend analysis through artifact storage

### Security Monitoring

- Continuous vulnerability scanning
- Automated security report generation
- Integration with GitHub's native security features

## Standards and Best Practices

Based on industry standards and research:

### GitHub Actions Best Practices

- Following [GitHub Actions documentation](https://docs.github.com/actions)
  patterns
- Using official and community-vetted actions
- Implementing proper artifact management

### Swift Package Testing

- Following
  [Swift Package Manager](https://github.com/swiftlang/swift-package-manager)
  guidelines
- Multi-platform testing as recommended by Swift community
- Code coverage generation following Swift testing standards

### Deno Testing Standards

- Following
  [Deno CI documentation](https://docs.deno.com/runtime/reference/continuous_integration/)
- Proper permission management for security
- Comprehensive testing approach as outlined in Deno best practices

### WebAssembly Testing

- Following [WebAssembly specification](https://www.w3.org/TR/wasm-core-1/)
  guidelines
- Browser compatibility testing
- Memory management validation

## Configuration Files

### CI-Specific Import Map

`.github/ci-import-map.json` provides CI-specific dependency resolution:

- Pinned versions for consistency
- CI-optimized import paths
- Reduced network dependencies

### Environment Variables

- `CACHE_VERSION`: Cache invalidation control
- Platform-specific versions for consistency
- Security-related configurations

## Troubleshooting

### Common Issues and Solutions

1. **Cache Misses**
   - Check `CACHE_VERSION` for proper invalidation
   - Verify hash key configuration
   - Clear corrupted caches if needed

2. **Permission Errors**
   - Verify Deno permission flags
   - Check GitHub Actions token permissions
   - Ensure proper secrets configuration

3. **Performance Test Failures**
   - Check system resource availability
   - Verify GPU drivers for WebGPU tests
   - Adjust thresholds for CI environment variations

4. **Swift Build Failures**
   - Verify Xcode tools installation (macOS)
   - Check Swift version compatibility
   - Review Package.swift configuration

## Future Enhancements

### Planned Improvements

- ARM64 testing for Apple Silicon compatibility
- Container-based testing for reproducible environments
- Advanced performance profiling with detailed metrics
- Automated performance report generation

### Monitoring Expansion

- Real-time performance dashboards
- Automated alerting for regressions
- Integration with external monitoring services

---

This CI/CD pipeline represents a comprehensive approach to maintaining code
quality, security, and performance for a complex mixed-language (Swift/Deno)
WebAssembly project. It follows industry best practices and adapts them to the
specific needs of the Blitz3D-WASM compilation system.
