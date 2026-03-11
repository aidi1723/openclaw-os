import type { AppId } from "@/apps/types";
import type { PublisherPrefill } from "@/lib/ui-events";
import { requestOpenApp, requestOpenPublisher } from "@/lib/ui-events";

export type AssetJumpTarget =
  | {
      kind: "record";
      appId: AppId;
      eventName: string;
      eventDetail: Record<string, string | undefined>;
    }
  | {
      kind: "publisher";
      prefill: PublisherPrefill;
    };

export function jumpToAssetTarget(target?: AssetJumpTarget | null) {
  if (typeof window === "undefined" || !target) return;

  if (target.kind === "publisher") {
    requestOpenPublisher(target.prefill);
    return;
  }

  requestOpenApp(target.appId);
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent(target.eventName, {
        detail: target.eventDetail,
      }),
    );
  }, 110);
}
