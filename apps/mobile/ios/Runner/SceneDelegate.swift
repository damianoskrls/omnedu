import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  override func sceneDidEnterBackground(_ scene: UIScene) {
    IosNotices.schedule()
    IosNotices.refresh { _ in }
    super.sceneDidEnterBackground(scene)
  }
}
