JSB.require("SelectionBridge");
JSB.require("CitekeyBridge");
JSB.require("StorageBridge");
JSB.require("MediaBridge");
JSB.require("LayoutBridge");
JSB.require("DragGuard");
JSB.require("PanelBridge");

// MarginNote 里所有插件的原生 JS 共用一个全局环境，顶层函数会和其他插件的同名函数互相覆盖，
// 所以消息分派也和其他模块一样放进带前缀的命名空间。
var __MN_WRITER_MESSAGES__ = (function () {
  function handle(addon, name, payload) {
    if (name === "ping") {
      return { ok: true, payload: payload === undefined ? null : payload };
    }
    if (name === "selection:list") {
      return { noteIds: __MN_WRITER_SELECTION__.selectedNoteIds(addon) };
    }
    if (name === "storage:load") {
      var keys = payload && Array.isArray(payload.keys) ? payload.keys : [];
      return { values: __MN_WRITER_STORAGE__.load(keys) };
    }
    if (name === "storage:save") {
      return __MN_WRITER_STORAGE__.save(payload);
    }
    if (name === "documents:load") {
      return __MN_WRITER_STORAGE__.loadDocuments();
    }
    if (name === "documents:save") {
      return __MN_WRITER_STORAGE__.saveDocuments(payload);
    }
    if (name === "knowledge:load") {
      return __MN_WRITER_STORAGE__.loadKnowledge();
    }
    if (name === "knowledge:save") {
      return __MN_WRITER_STORAGE__.saveKnowledge(payload);
    }
    if (name === "media:read") {
      return __MN_WRITER_MEDIA__.read(payload);
    }
    if (name === "citekey:list") {
      return { values: __MN_WRITER_CITEKEY__.load() };
    }
    if (name === "citekey:endpoint") {
      return { endpoint: __MN_WRITER_CITEKEY__.endpoint() };
    }
    if (name === "citekey:index") {
      return { index: __MN_WRITER_CITEKEY__.loadIndex() };
    }
    if (name === "citekey:save") {
      var saved = __MN_WRITER_CITEKEY__.saveIndex(
        payload && payload.values,
        payload && payload.at
      );
      return { ok: saved };
    }
    if (name === "layout:metrics") {
      return __MN_WRITER_PANEL__.safeSize() || {};
    }
    if (name === "layout:apply") {
      return __MN_WRITER_PANEL__.layout() || {};
    }
    throw new Error("未知的面板命令：" + name);
  }

  return { handle: handle };
})();

JSB.newAddon = function (mainPath) {
  return JSB.defineClass("MNWriterAddon : JSExtension <UIGestureRecognizerDelegate>", {
    sceneWillConnect: function () {
      var addon = self;
      addon.addonid = "top.museday.mn.writer";
      addon.mainPath = mainPath;
      addon.panelBridge = __MN_WRITER_PANEL__.create({
        getWindow: function () {
          return addon.window;
        },
        getAddon: function () {
          return addon;
        },
        onMessage: function (name, payload) {
          return __MN_WRITER_MESSAGES__.handle(addon, name, payload);
        },
      });
      addon.panelBridge.installSelectionObserver(addon);
    },

    sceneDidDisconnect: function () {
      if (!self.panelBridge) return;
      self.panelBridge.removeSelectionObserver(self);
      self.panelBridge.close();
    },

    notebookWillOpen: function () {
      if (!self.panelBridge) return;
      if (!self.panelBridge.open()) {
        Application.sharedInstance().showHUD(
          "无法打开面板，请在沉浸模式下打开，并确认模板插件名单包含 " + self.addonid,
          self.window,
          2,
        );
      }
    },

    onWriterSelectionChanged: function () {
      if (self.panelBridge) self.panelBridge.handleSelectionChanged();
    },

    /** 顶栏拖动手势回调，位移由 DragGuard 直接改写面板视图位置。 */
    handleWriterDrag: function (gesture) {
      return __MN_WRITER_DRAG_GUARD__.pan(gesture);
    },

    /** 只允许从顶栏开始的手势参与识别，正文区域交给网页处理。 */
    gestureRecognizerShouldBegin: function (gesture) {
      return __MN_WRITER_DRAG_GUARD__.shouldBegin(gesture);
    },

    controllerWillLayoutSubviews: function (controller) {
      if (!self.panelBridge || !self.window) return;
      var study;
      try {
        study = Application.sharedInstance().studyController(self.window);
      } catch (error) {
        return;
      }
      if (controller !== study) return;
      self.panelBridge.layout();
    },

    queryAddonCommandStatus: function () {
      return {
        image: "icon.png",
        object: self,
        selector: "togglePanel:",
        checked: Boolean(self.panelBridge && self.panelBridge.isOpen()),
      };
    },

    togglePanel: function () {
      if (!self.panelBridge) return;
      self.panelBridge.toggle();
    },
  });
};
