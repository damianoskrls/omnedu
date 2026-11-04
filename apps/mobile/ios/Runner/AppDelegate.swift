import BackgroundTasks
import Flutter
import UIKit
import UserNotifications

// Firebase is configured from Dart (firebase_core / firebase_messaging).
// Do NOT `import FirebaseCore` / `FirebaseMessaging` — Xcode Cloud Archive
// failed with "Unable to resolve module dependency" on those modules.
// Instead forward the APNs token to FIRMessaging via the ObjC runtime.

private let noticeTaskId = "com.omnedu.omnedu.notices"

/// Holds the latest APNs device token and hands it to Firebase Messaging even
/// when FlutterFire's swizzling misses `didRegister` under Implicit Engine / UIScene.
enum IosPush {
  private static var pendingToken: Data?
  private static var flushTimer: Timer?

  static func remember(_ deviceToken: Data) {
    pendingToken = deviceToken
    applyPending()
  }

  static func applyPending() {
    guard let token = pendingToken else { return }
    guard let messagingClass = NSClassFromString("FIRMessaging") as? NSObject.Type else {
      // Firebase Messaging not ready yet (Dart configure still pending) — retry briefly.
      scheduleFlush()
      return
    }
    let messagingSelector = NSSelectorFromString("messaging")
    guard messagingClass.responds(to: messagingSelector),
          let messaging = messagingClass.perform(messagingSelector)?.takeUnretainedValue() as? NSObject
    else {
      scheduleFlush()
      return
    }
    messaging.setValue(token, forKey: "APNSToken")
    flushTimer?.invalidate()
    flushTimer = nil
  }

  static func register() {
    UIApplication.shared.registerForRemoteNotifications()
    applyPending()
  }

  private static func scheduleFlush() {
    if flushTimer != nil { return }
    var tries = 0
    flushTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
      tries += 1
      applyPending()
      // Stop once applied (timer cleared in applyPending) or after ~30s.
      if tries >= 30 {
        timer.invalidate()
        flushTimer = nil
      }
    }
  }
}

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: noticeTaskId, using: nil) { task in
      guard let refresh = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      IosNotices.handle(refresh)
    }
    application.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
    let ready = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    let center = UNUserNotificationCenter.current()
    center.delegate = self
    // Ask for permission, then register with APNs so FCM can deliver when the
    // app is backgrounded / killed. FlutterFire alone often misses this under
    // FlutterImplicitEngineDelegate (plugins register after didFinishLaunching).
    center.requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
      DispatchQueue.main.async {
        IosPush.register()
      }
    }
    IosPush.register()
    return ready
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Critical: assign APNs token to FIRMessaging explicitly. Method swizzling
    // does not reliably catch this with FlutterImplicitEngineDelegate + UIScene.
    IosPush.remember(deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("Omnedu APNs registration failed: \(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  override func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    IosNotices.schedule()
    IosNotices.refresh { found in
      completionHandler(found ? .newData : .noData)
    }
  }

  override func applicationDidEnterBackground(_ application: UIApplication) {
    IosNotices.schedule()
    IosNotices.refresh { _ in }
    super.applicationDidEnterBackground(application)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // Re-register + flush after plugins load so FIRMessaging can accept APNsToken.
    IosPush.register()
    let channel = FlutterMethodChannel(
      name: "com.omnedu.omnedu/notices",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      let args = call.arguments as? [String: Any] ?? [:]
      switch call.method {
      case "session":
        IosNotices.save(
          access: args["access"] as? String ?? "",
          refresh: args["refresh"] as? String ?? "",
          schoolId: args["schoolId"] as? String ?? "",
          role: args["role"] as? String ?? "",
          api: args["api"] as? String ?? ""
        )
        IosNotices.schedule()
        result(nil)
      case "clear":
        IosNotices.clear()
        result(nil)
      case "check":
        IosNotices.refresh { _ in }
        result(nil)
      case "registerPush":
        IosPush.register()
        result(nil)
      case "flushApnsToken":
        // Called from Dart after Firebase.initializeApp so APNSToken sticks.
        IosPush.applyPending()
        IosPush.register()
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}

enum IosNotices {
  private static let defaults = UserDefaults.standard
  private static let shownKey = "flutter.shown_notification_ids"
  private static var lastCheck = Date.distantPast

  static func save(access: String, refresh: String, schoolId: String, role: String, api: String) {
    defaults.set(access, forKey: "omnedu.notice.access")
    defaults.set(refresh, forKey: "omnedu.notice.refresh")
    defaults.set(schoolId, forKey: "omnedu.notice.schoolId")
    defaults.set(role, forKey: "omnedu.notice.role")
    defaults.set(api, forKey: "omnedu.notice.api")
  }

  static func clear() {
    for key in ["omnedu.notice.access", "omnedu.notice.refresh", "omnedu.notice.schoolId", "omnedu.notice.role", "omnedu.notice.api"] {
      defaults.removeObject(forKey: key)
    }
  }

  static func schedule() {
    let request = BGAppRefreshTaskRequest(identifier: noticeTaskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
  }

  static func handle(_ task: BGAppRefreshTask) {
    schedule()
    task.expirationHandler = {}
    refresh { found in
      task.setTaskCompleted(success: true)
      _ = found
    }
  }

  static func refresh(completion: @escaping (Bool) -> Void) {
    if Date().timeIntervalSince(lastCheck) < 12 {
      completion(false)
      return
    }
    lastCheck = Date()
    let application = UIApplication.shared
    var taskId = UIBackgroundTaskIdentifier.invalid
    taskId = application.beginBackgroundTask {
      if taskId != .invalid {
        application.endBackgroundTask(taskId)
      }
    }
    fetch { found in
      completion(found)
      if taskId != .invalid {
        application.endBackgroundTask(taskId)
      }
    }
  }

  private static func fetch(completion: @escaping (Bool) -> Void) {
    guard var api = defaults.string(forKey: "omnedu.notice.api"), !api.isEmpty,
          let schoolId = defaults.string(forKey: "omnedu.notice.schoolId"), !schoolId.isEmpty,
          let refreshToken = defaults.string(forKey: "omnedu.notice.refresh"), !refreshToken.isEmpty
    else {
      completion(false)
      return
    }
    if api.hasSuffix("/") { api.removeLast() }
    var access = defaults.string(forKey: "omnedu.notice.access") ?? ""
    let role = defaults.string(forKey: "omnedu.notice.role") ?? ""
    let group = DispatchGroup()
    group.enter()
    renewIfNeeded(api: api, access: access, refresh: refreshToken, schoolId: schoolId, role: role) { next in
      if let next = next, !next.isEmpty { access = next }
      group.leave()
    }
    group.notify(queue: .main) {
      guard !access.isEmpty, let url = URL(string: "\(api)/schools/\(schoolId)/notifications/inbox") else {
        completion(false)
        return
      }
      var request = URLRequest(url: url)
      request.setValue("Bearer \(access)", forHTTPHeaderField: "Authorization")
      URLSession.shared.dataTask(with: request) { data, response, _ in
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200, let data = data, let rows = inboxRows(data) else {
          DispatchQueue.main.async { completion(false) }
          return
        }
        postNew(rows) { found in
          DispatchQueue.main.async { completion(found) }
        }
      }.resume()
    }
  }

  private static func renewIfNeeded(api: String, access: String, refresh: String, schoolId: String, role: String, done: @escaping (String?) -> Void) {
    if !access.isEmpty && !tokenExpired(access) {
      done(access)
      return
    }
    guard let url = URL(string: "\(api)/auth/refresh") else {
      done(access)
      return
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: String] = ["refreshToken": refresh, "schoolId": schoolId, "role": role]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    URLSession.shared.dataTask(with: request) { data, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      guard status == 200, let data = data,
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let payload = json["data"] as? [String: Any],
            let nextAccess = payload["accessToken"] as? String, !nextAccess.isEmpty
      else {
        done(access)
        return
      }
      let nextRefresh = payload["refreshToken"] as? String ?? refresh
      defaults.set(nextAccess, forKey: "omnedu.notice.access")
      defaults.set(nextRefresh, forKey: "omnedu.notice.refresh")
      done(nextAccess)
    }.resume()
  }

  private static func tokenExpired(_ token: String) -> Bool {
    let parts = token.split(separator: ".")
    guard parts.count > 1 else { return true }
    var base64 = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    let padding = (4 - base64.count % 4) % 4
    if padding < 4 { base64 += String(repeating: "=", count: padding) }
    guard let data = Data(base64Encoded: base64),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return true }
    let exp = (json["exp"] as? NSNumber)?.doubleValue ?? (json["exp"] as? Double) ?? 0
    return Date().timeIntervalSince1970 > exp - 30
  }

  private static func inboxRows(_ data: Data) -> [[String: Any]]? {
    guard let json = try? JSONSerialization.jsonObject(with: data) else { return nil }
    let raw: Any?
    if let wrapped = json as? [String: Any] {
      raw = wrapped["data"] ?? wrapped
    } else {
      raw = json
    }
    guard let list = raw as? [Any] else { return nil }
    return list.compactMap { $0 as? [String: Any] }
  }

  private static func postNew(_ rows: [[String: Any]], completion: @escaping (Bool) -> Void) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      let allowed = settings.authorizationStatus == .authorized
        || settings.authorizationStatus == .provisional
        || settings.authorizationStatus == .ephemeral
      guard allowed else {
        completion(false)
        return
      }
      var shown = defaults.stringArray(forKey: shownKey) ?? []
      var found = false
      let group = DispatchGroup()
      for row in rows {
      guard let id = row["id"] as? String, !id.isEmpty, !shown.contains(id) else { continue }
      if row["isRead"] as? Bool == true { continue }
      if let sent = row["sentAt"] as? String, let date = isoDate(sent), Date().timeIntervalSince(date) > 12 * 60 * 60 {
        shown.append(id)
        continue
      }
      let title = (row["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
      let body = noticeBody(row)
      let content = UNMutableNotificationContent()
      content.title = (title?.isEmpty == false ? title! : "Ονειροχώρα")
      content.body = body.isEmpty ? "Νέα ειδοποίηση" : String(body.prefix(180))
      content.sound = .default
      let payload: [String: Any] = [
        "id": id,
        "type": row["type"] as? String ?? "broadcast",
        "title": content.title,
        "body": body,
        "sentAt": row["sentAt"] as? String ?? "",
        "data": row["data"] as? [String: Any] ?? [:],
      ]
      let payloadData = try? JSONSerialization.data(withJSONObject: payload)
      let payloadText = payloadData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
      let hash = id.utf8.reduce(0) { ($0 &* 31 &+ Int($1)) & 0x7fffffff }
      content.userInfo = [
        "NotificationId": hash,
        "presentAlert": true,
        "presentSound": true,
        "presentBadge": true,
        "presentBanner": true,
        "presentList": true,
        "payload": payloadText,
      ]
      let request = UNNotificationRequest(identifier: "omnedu-\(id)", content: content, trigger: nil)
      group.enter()
      center.add(request) { error in
        DispatchQueue.main.async {
          if error == nil {
            shown.append(id)
            found = true
          }
          group.leave()
        }
      }
    }
      group.notify(queue: .main) {
        if shown.count > 200 { shown = Array(shown.suffix(200)) }
        defaults.set(shown, forKey: shownKey)
        completion(found)
      }
    }
  }

  private static func noticeBody(_ row: [String: Any]) -> String {
    let body = (row["body"] as? String) ?? ""
    let type = (row["type"] as? String) ?? ""
    let title = ((row["title"] as? String) ?? "").lowercased()
    let data = row["data"] as? [String: Any]
    let screen = data?["screen"] as? String ?? ""
    let regulation = type == "regulation" || screen == "regulations" || title.contains("κανονισμ")
    if regulation && (body.count > 220 || !body.contains("Πάτα")) {
      return "Ανέβηκε κανονισμός. Πάτα για να τον διαβάσεις."
    }
    return body
  }

  private static func isoDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
  }
}
