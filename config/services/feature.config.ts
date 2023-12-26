import { interfaces } from "inversify";
import SI from "@config/inversify.types";
import FeatureInterface from "@src/Interfaces/FeatureInterface";
import ExplorerManager from "@src/Feature/Explorer/ExplorerManager";
import FeatureComposer from "@src/Feature/FeatureComposer";
import ExplorerSort from "@src/Feature/Explorer/ExplorerSort";
import ManagerComposer from "@src/Feature/ManagerComposer";
import SearchFeature from "@src/Feature/Search/SearchFeature";
import TabManager from "@src/Feature/Tab/TabManager";
import { AliasFeature } from "@src/Feature/Alias/AliasFeature";
import EnsureStrategy from "@src/Feature/Alias/Strategy/EnsureStrategy";
import AdjustStrategy from "@src/Feature/Alias/Strategy/AdjustStrategy";
import ReplaceStrategy from "@src/Feature/Alias/Strategy/ReplaceStrategy";
import SuggestFeature from "@src/Feature/Suggest/SuggestFeature";
import StarredManager from "@src/Feature/Starred/StarredManager";
import GraphManager from "@src/Feature/Graph/GraphManager";
import { MarkdownHeaderManager } from "@src/Feature/MarkdownHeader/MarkdownHeaderManager";
import {
    StrategyInterface as AliasStrategyInterface,
    ValidatorInterface as AliasValidatorInterface,
} from "../../src/Feature/Alias/Interfaces";
import { StrategyType as AliasStrategyType, ValidatorType as AliasValidatorType } from "../../src/Feature/Alias/Types";
import { ValidatorAuto, ValidatorRequired } from "@src/Feature/Alias/Validator";
import { InlineTitleManager } from "@src/Feature/InlineTitle/InlineTitleManager";
import { CanvasManager } from "@src/Feature/Canvas/CanvasManager";
import AbstractManager from "../../src/Feature/AbstractManager";
import FeatureHelper from "@src/Utils/FeatureHelper";
import FeatureService from "@src/Feature/FeatureService";
import BacklinkManager from "../../src/Feature/Backlink/BacklinkFeature";
import NoteLinkFeature from "../../src/Feature/NoteLink/NoteLinkFeature";
import NoteLinkApprove from "../../src/Feature/NoteLink/NoteLinkApprove";
import AliasConfig from "@src/Feature/Alias/AliasConfig";
import { KeyStorageInterface } from "@src/Storage/Interfaces";
import { SettingsType } from "@src/Settings/SettingsType";
import { Feature } from "@src/Enum";
import { MetadataCacheExt, TFileExplorerItem } from "obsidian";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import { ExplorerFileItemMutator } from "@src/Feature/Explorer/ExplorerFileItemMutator";
import Storage from "@src/Storage/Storage";
import Container = interfaces.Container;
import { MetadataCacheFactory } from "@config/inversify.factory.types";

export default (container: Container) => {
    container.bind(SI["feature:service"]).to(FeatureService).inSingletonScope();
    container.bind(SI["feature:composer"]).to(FeatureComposer).inSingletonScope();
    container.bind(SI["manager:composer"]).to(ManagerComposer).inSingletonScope();
    container.bind(SI["feature:helper"]).to(FeatureHelper).inSingletonScope();

    container
        .bind<interfaces.AutoNamedFactory<FeatureInterface<any>>>(SI["factory:feature"])
        .toAutoNamedFactory<FeatureInterface<any>>(SI.feature)
        .onActivation((c, i) => (name: string) => {
            const feature: FeatureInterface<any> = i(name);
            if (feature instanceof AbstractManager) {
                const service: FeatureService = c.container.get(SI["feature:service"]);
                feature.setResolver(service.createResolver(feature.getId()));
            }
            return feature;
        });
    container.bind<FeatureInterface<any>>(SI.feature).to(AliasFeature).whenTargetNamed(AliasFeature.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(ExplorerManager).whenTargetNamed(ExplorerManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(SearchFeature).whenTargetNamed(SearchFeature.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(StarredManager).whenTargetNamed(StarredManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(TabManager).whenTargetNamed(TabManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(SuggestFeature).whenTargetNamed(SuggestFeature.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(GraphManager).whenTargetNamed(GraphManager.getId());
    container
        .bind<FeatureInterface<any>>(SI.feature)
        .to(MarkdownHeaderManager)
        .whenTargetNamed(MarkdownHeaderManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(BacklinkManager).whenTargetNamed(BacklinkManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(NoteLinkFeature).whenTargetNamed(NoteLinkFeature.getId());
    container
        .bind<FeatureInterface<any>>(SI.feature)
        .to(InlineTitleManager)
        .whenTargetNamed(InlineTitleManager.getId());
    container.bind<FeatureInterface<any>>(SI.feature).to(CanvasManager).whenTargetNamed(CanvasManager.getId());

    container
        .bind(SI["factory:alias:modifier:strategy"])
        .toAutoNamedFactory<AliasStrategyInterface>(SI["alias:modifier:strategy"]);
    container.bind(SI["alias:modifier:strategy"]).to(EnsureStrategy).whenTargetNamed(AliasStrategyType.Ensure);
    container.bind(SI["alias:modifier:strategy"]).to(AdjustStrategy).whenTargetNamed(AliasStrategyType.Adjust);
    container.bind(SI["alias:modifier:strategy"]).to(ReplaceStrategy).whenTargetNamed(AliasStrategyType.Replace);

    container.bind(SI["feature:alias:config"]).to(AliasConfig);
    container
        .bind(SI["factory:alias:modifier:validator"])
        .toAutoNamedFactory<AliasValidatorInterface>(SI["alias:modifier:validator"]);
    container
        .bind(SI["alias:modifier:validator"])
        .to(ValidatorAuto)
        .whenTargetNamed(AliasValidatorType.FrontmatterAuto);
    container
        .bind(SI["alias:modifier:validator"])
        .to(ValidatorRequired)
        .whenTargetNamed(AliasValidatorType.FrontmatterRequired);

    container.bind(SI["feature:notelink:approve"]).to(NoteLinkApprove);
    container
        .bind(SI["feature:config"])
        .toDynamicValue(c => {
            const feature = c.currentRequest.target.getNamedTag().value as Feature;
            return c.container
                .get<KeyStorageInterface<SettingsType>>(SI["settings:storage"])
                .get("features")
                .get(feature)
                .value();
        })
        .when(() => true);

    container
        .bind(SI["feature:explorer:file_mutator:factory"])
        .toFunction((item: TFileExplorerItem, resolver: ResolverInterface, factory: MetadataCacheFactory<MetadataCacheExt>) => {
            return new ExplorerFileItemMutator(item, resolver, factory);
        });
    container.bind(SI["feature:explorer:sort"]).to(ExplorerSort);
    container.bind(SI["factory:feature:explorer:sort"]).toFunction(() => {
        const enabled = container
            .get<Storage<SettingsType>>(SI["settings:storage"])
            .get("features")
            .get(Feature.Explorer)
            .get("sort")
            .value();
        return enabled ? container.get(SI["feature:explorer:sort"]) : null;
    });
};
