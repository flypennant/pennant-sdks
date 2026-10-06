// swift-tools-version: 5.9
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
    .target(name: "Pennant"),
    .testTarget(name: "PennantTests", dependencies: ["Pennant"]),
  ]
)
