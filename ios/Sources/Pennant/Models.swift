import Foundation

/// Evaluation context fields accepted by POST /api/client/evaluate.
public struct EvaluationContext: Sendable, Equatable {
  public var userId: String?
  public var sessionId: String?
  public var remoteAddress: String?
  public var hostname: String?
  public var properties: [String: String]?

  public init(
    userId: String? = nil,
    sessionId: String? = nil,
    remoteAddress: String? = nil,
    hostname: String? = nil,
    properties: [String: String]? = nil
  ) {
    self.userId = userId
    self.sessionId = sessionId
    self.remoteAddress = remoteAddress
    self.hostname = hostname
    self.properties = properties
  }

  func asDictionary() -> [String: Any] {
    var map: [String: Any] = [:]
    if let userId { map["userId"] = userId }
    if let sessionId { map["sessionId"] = sessionId }
    if let remoteAddress { map["remoteAddress"] = remoteAddress }
    if let hostname { map["hostname"] = hostname }
    if let properties, !properties.isEmpty { map["properties"] = properties }
    return map
  }
}

/// One flag evaluation result.
public struct FlagEvaluation: Sendable, Equatable {
  public var enabled: Bool
  public var variant: String?

  public init(enabled: Bool, variant: String? = nil) {
    self.enabled = enabled
    self.variant = variant
  }
}

public typealias FlagMap = [String: FlagEvaluation]

/// Options for ``PennantClient``.
public struct ClientOptions: Sendable {
  public var apiUrl: String
  public var clientKey: String
  public var environment: String
  public var project: String?
  public var context: EvaluationContext

  public init(
    apiUrl: String,
    clientKey: String,
    environment: String = "development",
    project: String? = nil,
    context: EvaluationContext = EvaluationContext()
  ) {
    self.apiUrl = apiUrl
    self.clientKey = clientKey
    self.environment = environment
    self.project = project
    self.context = context
  }
}

/// Raised when evaluate fails.
public struct PennantError: Error, LocalizedError, Equatable {
  public var message: String

  public init(_ message: String) {
    self.message = message
  }

  public var errorDescription: String? { message }
}
