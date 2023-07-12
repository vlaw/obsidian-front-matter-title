import { inject, named } from "inversify";
import SI from "@config/inversify.types";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import FunctionReplacer from "@src/Utils/FunctionReplacer";
import { Feature, Leaves } from "@src/Enum";
import { MarkdownViewExt, SearchPluginView, SearchDOM } from "obsidian";
import AbstractFeature from "@src/Feature/AbstractFeature";
import FeatureService from "@src/Feature/FeatureService";
import { ResolverInterface } from "@src/Resolver/Interfaces";

type Replacer = FunctionReplacer<SearchDOM, "addResult", SearchFeature>;

export default class SearchFeature extends AbstractFeature<Feature> {
    private enabled = false;
    private replacers: { [k: string]: Replacer } = {};
    private resolver: ResolverInterface;

    constructor(
        @inject(SI["facade:obsidian"])
        private facade: ObsidianFacade,
        @inject(SI.logger)
        @named("manager:starred")
        private logger: LoggerInterface,
        @inject(SI["feature:service"])
        service: FeatureService
    ) {
        super();
        this.resolver = service.createResolver(this.getId());
    }

    private getSearchView(): SearchPluginView | null {
        return this.facade.getViewsOfType<SearchPluginView>("search")?.[0] ?? null;
    }

    private getMarkdownQueryDomes(): { [k: string]: SearchDOM } {
        const domes: { [k: string]: SearchDOM } = {};
        this.facade.getViewsOfType<MarkdownViewExt>(Leaves.MD).forEach(e => {
            for (const child of e.currentMode._children) {
                if (child?.dom && child?.query) {
                    domes[e.leaf.id] = child.dom;
                }
            }
        });
        return domes;
    }

    private getSearchDomes(): { [k: string]: SearchDOM } | null {
        const domes = this.getMarkdownQueryDomes();
        const view = this.getSearchView();
        if (view.dom) {
            domes[view.leaf.id] = view.dom;
        }
        return domes;
    }

    private initReplacer(): Replacer[] {
        const replacers: { [k: string]: Replacer } = {};
        for (const [id, dom] of Object.entries(this.getSearchDomes())) {
            console.log(dom);
            if (this.replacers[id]) {
                replacers[id] = this.replacers[id];
                continue;
            }
            replacers[id] = FunctionReplacer.create(dom, "addResult", this, function (self, defaultArgs, vanilla) {
                const c = vanilla.call(this, ...defaultArgs);
                const file = defaultArgs[0];
                if (file?.extension === "md") {
                    const title = self.resolver.resolve(file.path);
                    if (title) {
                        c.containerEl.find(".tree-item-inner").setText(title);
                    }
                }
                return c;
            });
        }
        this.replacers = replacers;
        console.log(this.replacers);

        return Object.values(replacers);
    }
    private triggerMarkdownDomes(): void {
        for (const dom of Object.values(this.getMarkdownQueryDomes())) {
            for (const [file, el] of dom.resultDomLookup.entries()) {
                el.containerEl.find(".tree-item-inner").setText(file.basename);
            }
        }
    }

    public async disable(): Promise<void> {
        this.initReplacer().forEach(e => e.disable());
        this.enabled = false;
        this.getSearchView()?.startSearch();
        this.triggerMarkdownDomes();
    }

    public async enable(): Promise<void> {
        this.initReplacer().forEach(e => e.enable());
        this.enabled = !Object.isEmpty(this.replacers);
        if (this.enabled) {
            this.getSearchView().startSearch();
            this.triggerMarkdownDomes();
        }
    }

    static getId(): Feature {
        return Feature.Search;
    }
    getId(): Feature {
        return SearchFeature.getId();
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}
