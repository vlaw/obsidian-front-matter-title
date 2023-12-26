import { TFile, TFileExplorerItem, TFileExplorerView } from "obsidian";
import { MetadataCacheExt } from "obsidian";
import { Feature, Leaves } from "@src/Enum";
import { inject, injectable } from "inversify";
import SI from "@config/inversify.types";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import AbstractManager from "@src/Feature/AbstractManager";
import ExplorerViewUndefined from "@src/Feature/Explorer/ExplorerViewUndefined";
import { ExplorerFileItemMutator } from "./ExplorerFileItemMutator";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import ExplorerSort from "@src/Feature/Explorer/ExplorerSort";
import ListenerRef from "@src/Components/EventDispatcher/Interfaces/ListenerRef";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import {AppEvents} from "@src/Types";
import { MetadataCacheFactory } from "@config/inversify.factory.types";


@injectable()
export default class ExplorerManager extends AbstractManager {
    private explorerView: TFileExplorerView = null;
    private modified = new WeakMap<TFileExplorerItem, ExplorerFileItemMutator>();
    private enabled = false;
    private sort: ExplorerSort = null;
    private ref: ListenerRef<"metadata:cache:changed"> = null;

    constructor(
        @inject(SI["facade:obsidian"])
        private facade: ObsidianFacade,
        @inject(SI["factory:metadata:cache"])
        private metadataCacheFactory: MetadataCacheFactory<MetadataCacheExt>,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<AppEvents>,
        @inject(SI["feature:explorer:file_mutator:factory"])
        private factory: (item: TFileExplorerItem, resolver: ResolverInterface, factory: MetadataCacheFactory<MetadataCacheExt>) => ExplorerFileItemMutator,
        @inject(SI["factory:feature:explorer:sort"])
        sortFactory: () => ExplorerSort | null
    ) {
        super();
        this.sort = sortFactory();
    }

    static getId(): Feature {
        return Feature.Explorer;
    }

    getId(): Feature {
        return Feature.Explorer;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    protected doDisable() {
        if (this.explorerView) {
            this.restoreTitles();
            this.explorerView = null;
        }
        this.sort?.stop();

        // detaching
        this.dispatcher.removeListener(this.ref);
        this.ref = null;

        this.enabled = false;
    }

    protected doEnable() {
        this.explorerView = this.getExplorerView();
        this.sort?.start();
        this.enabled = true;

        // attach
        this.ref = this.dispatcher.addListener({
            name: "metadata:cache:changed",
            cb: e => {
                const path = e.get().path;
                this.doUpdate(path);
            }
        });
        this.refresh().catch(console.error);
    }

    protected doRefresh(): Promise<{ [p: string]: boolean }> {
        return this.updateInternal(Object.values(this.explorerView.fileItems));
    }

    protected async doUpdate(path: string): Promise<boolean> {
        const item = this.explorerView.fileItems[path];
        await this.updateInternal(item ? [item] : []);
        return !!item;
    }

    private getExplorerView(): TFileExplorerView | null {
        const views = this.facade.getViewsOfType(Leaves.FE);

        if (views.length > 1) {
            throw new Error("There are some explorers' leaves");
        }

        const view = views?.[0];

        //TODO: what if it be later?
        if (view === undefined || view === null) {
            throw new ExplorerViewUndefined("Explorer view is undefined");
        }

        return view as TFileExplorerView;
    }

    private async updateInternal(items: TFileExplorerItem[]): Promise<{ [k: string]: boolean }> {
        for (const i of items) {
            if (!(i.file instanceof TFile)) {
                continue;
            }
            if (!this.modified.has(i)) {
                this.modified.set(i, this.factory(i, this.resolver, this.metadataCacheFactory));
            }
            i.updateTitle();
        }
        return {};
    }

    private restoreTitles(): void {
        Object.values(this.explorerView.fileItems).map(this.restore.bind(this));
    }

    private restore(item: TFileExplorerItem): boolean {
        if (this.modified.has(item)) {
            this.modified.get(item).destroy();
            item.updateTitle();
            this.modified.delete(item);
            return true;
        }
        return false;
    }
}
