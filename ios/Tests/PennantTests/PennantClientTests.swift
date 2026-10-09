import Foundation
import XCTest

@testable import Pennant

final class PennantClientTests: XCTestCase {
  override func tearDown() {
    MockURLProtocol.requestHandler = nil
    super.tearDown()
  }

  func testEvaluatePostsBearerAndReturnsVariant() async throws {
    MockURLProtocol.requestHandler = { request in
      XCTAssertEqual(request.url?.path, "/api/client/evaluate")
      XCTAssertEqual(request.httpMethod, "POST")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer pennant-client-demo")
      let body = String(data: request.httpBody ?? Data(), encoding: .utf8) ?? ""
      XCTAssertTrue(body.contains("\"userId\":\"ada\""))
      XCTAssertTrue(body.contains("\"remoteAddress\":\"127.0.0.1\""))
      XCTAssertTrue(body.contains("\"hostname\":\"app.local\""))
      XCTAssertTrue(body.contains("\"environment\":\"production\""))
      XCTAssertTrue(body.contains("\"project\":\"default\""))
      let data = Data(
        #"{"flags":{"checkout-v2":{"enabled":true,"variant":"treatment"}}}"#.utf8
      )
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
      )!
      return (response, data)
    }

    let client = PennantClient(
      options: ClientOptions(
        apiUrl: "https://pennant.test/",
        clientKey: "pennant-client-demo",
        environment: "production",
        project: "default",
        context: EvaluationContext(
          userId: "ada",
          remoteAddress: "127.0.0.1",
          hostname: "app.local"
        )
      ),
      session: mockSession()
    )

    let flags = try await client.evaluate()
    XCTAssertTrue(client.isEnabled("checkout-v2"))
    XCTAssertEqual(client.getVariant("checkout-v2"), "treatment")
    XCTAssertTrue(PennantClient.isEnabled(flags, key: "checkout-v2"))
    XCTAssertEqual(PennantClient.getVariant(flags, key: "checkout-v2"), "treatment")
  }

  func testEvaluateMapsUnauthorized() async {
    MockURLProtocol.requestHandler = { request in
      let data = Data(#"{"error":"Invalid client key."}"#.utf8)
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 401,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
      )!
      return (response, data)
    }

    let client = PennantClient(
      options: ClientOptions(
        apiUrl: "https://pennant.test",
        clientKey: "bad-key"
      ),
      session: mockSession()
    )

    do {
      _ = try await client.evaluate()
      XCTFail("expected error")
    } catch let error as PennantError {
      XCTAssertEqual(error.message, "Invalid client key.")
    } catch {
      XCTFail("unexpected error \(error)")
    }
  }

  func testEvaluateFallsBackToStatusForNonJsonError() async {
    MockURLProtocol.requestHandler = { request in
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 502,
        httpVersion: nil,
        headerFields: ["Content-Type": "text/html"]
      )!
      return (response, Data("<html>Bad Gateway</html>".utf8))
    }

    let client = PennantClient(
      options: ClientOptions(apiUrl: "https://pennant.test", clientKey: "pennant-client-demo"),
      session: mockSession()
    )

    do {
      _ = try await client.evaluate()
      XCTFail("expected error")
    } catch let error as PennantError {
      XCTAssertEqual(error.message, "Evaluation failed (502).")
      XCTAssertTrue(client.flags.isEmpty)
    } catch {
      XCTFail("unexpected error \(error)")
    }
  }

  func testBlankClientKeyThrowsInsteadOfCrashing() async {
    let client = PennantClient(
      options: ClientOptions(apiUrl: "https://pennant.test", clientKey: "  "),
      session: mockSession()
    )

    do {
      _ = try await client.evaluate()
      XCTFail("expected error")
    } catch let error as PennantError {
      XCTAssertEqual(error.message, "clientKey is required.")
    } catch {
      XCTFail("unexpected error \(error)")
    }
  }

  private func mockSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockURLProtocol.self]
    return URLSession(configuration: config)
  }
}

private final class MockURLProtocol: URLProtocol {
  static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

  override class func canInit(with request: URLRequest) -> Bool { true }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    guard let handler = MockURLProtocol.requestHandler else {
      client?.urlProtocol(self, didFailWithError: PennantError("missing handler"))
      return
    }
    do {
      // URLSession may move the body to httpBodyStream.
      var request = self.request
      if request.httpBody == nil, let stream = request.httpBodyStream {
        stream.open()
        defer { stream.close() }
        var data = Data()
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
          let read = stream.read(buffer, maxLength: 1024)
          if read <= 0 { break }
          data.append(buffer, count: read)
        }
        request.httpBody = data
      }
      let (response, data) = try handler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}
