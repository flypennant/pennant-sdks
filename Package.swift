// swift-tools-version: 5.9
// SwiftPM only reads a manifest at the repository root, so this one points at
// the sources in ios/. Keep it in step with ios/Package.swift.
import PackageDescription

let package = Package(
  name: "Pennant",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
    .tvOS(.v15),
    .watchOS(.v8),
  ],
  products: [
    .library(name: "Pennant", targets: ["Pennant"]),
  ],
  targets: [
    .target(name: "Pennant", path: "ios/Sources/Pennant"),
    .testTarget(name: "PennantTests", dependencies: ["Pennant"], path: "ios/Tests/PennantTests"),
  ]
)
