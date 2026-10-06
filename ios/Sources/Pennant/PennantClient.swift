import Foundation

/// POST /api/client/evaluate with a project client key.
///
/// Safe to share across tasks: the last result is guarded by a lock.
public final class PennantClient: @unchecked Sendable {
  private let apiUrl: String
  private let clientKey: String
  private let environment: String
  private let project: String?
  private let context: EvaluationContext
  private let session: URLSession
  private let lock = NSLock()
  private var storedFlags: FlagMap = [:]

  /// A blank `apiUrl` or `clientKey` does not crash the app; `evaluate` throws instead.
  public init(options: ClientOptions, session: URLSession = .shared) {
    var url = options.apiUrl.trimmingCharacters(in: .whitespacesAndNewlines)
    while url.hasSuffix("/") {
      url.removeLast()
    }
    self.apiUrl = url
    self.clientKey = options.clientKey.trimmingCharacters(in: .whitespacesAndNewlines)
    let environment = options.environment.trimmingCharacters(in: .whitespacesAndNewlines)
    self.environment = environment.isEmpty ? "development" : environment
    self.project = options.project
    self.context = options.context
    self.session = session
  }

  public var flags: FlagMap {
    lock.lock()
    defer { lock.unlock() }
    return storedFlags
  }

  /// POSTs to /api/client/evaluate. Pass nil to use the client default context.
  @discardableResult
  public func evaluate(_ override: EvaluationContext? = nil) async throws -> FlagMap {
    if apiUrl.isEmpty { throw PennantError("apiUrl is required.") }
    if clientKey.isEmpty { throw PennantError("clientKey is required.") }
    let active = override ?? context
    var payload: [String: Any] = [
      "context": active.asDictionary(),
      "environment": environment,
    ]
    if let project, !project.isEmpty {
      payload["project"] = project
    }

    guard let url = URL(string: apiUrl + "/api/client/evaluate") else {
      throw PennantError("Invalid apiUrl.")
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(clientKey)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: payload)

    let (data, response) = try await session.data(for: request)
    guard let status = (response as? HTTPURLResponse)?.statusCode else {
      throw PennantError("Evaluation failed (no HTTP response).")
    }

    if status >= 400 {
      // A proxy can answer with HTML, so a body that is not JSON falls back to the status.
      let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      if let message = body?["error"] as? String, !message.isEmpty {
        throw PennantError(message)
      }
      throw PennantError("Evaluation failed (\(status)).")
    }

    var parsed: [String: Any] = [:]
    if !data.isEmpty {
      guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw PennantError("Response must be a JSON object.")
      }
      parsed = object
    }

    let next = try Self.parseFlags(parsed["flags"])
    store(next)
    return next
  }

  public func isEnabled(_ key: String) -> Bool {
    flags[key]?.enabled == true
  }

  public func getVariant(_ key: String) -> String? {
    flags[key]?.variant
  }

  private func store(_ next: FlagMap) {
    lock.lock()
    defer { lock.unlock() }
    storedFlags = next
  }

  public static func isEnabled(_ flags: FlagMap, key: String) -> Bool {
    flags[key]?.enabled == true
  }

  public static func getVariant(_ flags: FlagMap, key: String) -> String? {
    flags[key]?.variant
  }

  private static func parseFlags(_ value: Any?) throws -> FlagMap {
    guard let value, !(value is NSNull) else { return [:] }
    guard let raw = value as? [String: Any] else {
      throw PennantError("Response flags must be an object.")
    }
    var parsed: FlagMap = [:]
    for (key, item) in raw {
      guard let flag = item as? [String: Any] else {
        throw PennantError("Flag evaluation must be an object.")
      }
      let enabled = flag["enabled"] as? Bool ?? false
      let variant = flag["variant"] as? String
      parsed[key] = FlagEvaluation(enabled: enabled, variant: variant)
    }
    return parsed
  }
}
