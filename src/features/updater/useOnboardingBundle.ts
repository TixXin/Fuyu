import { useEffect } from "react";
import { marketV1 } from "@fuyu/plugin-services";
import { recommendedBundle } from "../../lib/onboarding-bundle/recommend";
import { saveOnboardingBundle } from "../../lib/onboarding-bundle/storage";
import { windowServices } from "../plugin-kernel/services";

const market = windowServices.get(marketV1);

export function useOnboardingBundle() {
  useEffect(() => {
    let turn = 0;
    const publish = () => {
      const mine = (turn += 1);
      market.catalog().then(
        (snapshot) => {
          if (mine === turn) saveOnboardingBundle(recommendedBundle(snapshot));
        },
        () => {
          if (mine === turn) saveOnboardingBundle(null);
        },
      );
    };
    publish();
    const offWatch = windowServices.watch(publish);
    const offMarket = market.on("changed", publish);
    return () => {
      turn += 1;
      offWatch();
      void offMarket();
    };
  }, []);
}
