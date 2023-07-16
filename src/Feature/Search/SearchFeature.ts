import { inject, named } from "inversify";
import SI from "@config/inversify.types";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import FunctionReplacer from "@src/Utils/FunctionReplacer";
import { Feature, Leaves } from "@src/Enum";
import { MarkdownViewExt, SearchPluginView, SearchDOM, TFile } from "obsidian";
import AbstractFeature from "@src/Feature/AbstractFeature";
import FeatureService from "@src/Feature/FeatureService";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import EventDispatcherInterface from "../../Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { AppEvents } from "../../Types";
import ListenerRef from "../../Components/EventDispatcher/Interfaces/ListenerRef";
import Queue from 'queue'
type Replacer = FunctionReplacer<SearchDOM, "addResult", SearchFeature>;

//Looks like it should be two different features. Think about it.
export default class SearchFeature extends AbstractFeature<Feature> {
    private enabled = false;
    private replacers: WeakMap<SearchDOM, Replacer> = new WeakMap();
    private resolver: ResolverInterface;
    private refs: ListenerRef<keyof AppEvents>[] = [];
    private timer: NodeJS.Timeout = null;
    private queue: Queue = new Queue({ autostart: true });

    constructor(
        @inject(SI["facade:obsidian"])
        private facade: ObsidianFacade,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<AppEvents>,
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

    private getMarkdownQueryDomes(): SearchDOM[] {
        const domes: SearchDOM[] = [];
        this.facade.getViewsOfType<MarkdownViewExt>(Leaves.MD).forEach(e => {
            for (const child of e.currentMode._children) {
                if (child?.dom && child?.query) {
                    domes.push(child.dom);
                }
            }
        });
        return domes;
    }

    private getSearchDomes(): SearchDOM[] | null {
        const domes = this.getMarkdownQueryDomes();
        const view = this.getSearchView();
        if (view?.dom) {
            domes.push(view.dom);
        }
        return domes;
    }

    private initReplacers(): Map<SearchDOM, Replacer> {
        const replacers: Map<SearchDOM, Replacer> = new Map();;
        for (const dom of this.getSearchDomes()) {
            if (this.replacers.has(dom)) {
                continue;
            }
            console.log(dom, 'update');
            const replacer = FunctionReplacer.create(dom, "addResult", this, function (self, defaultArgs, vanilla) {
                const c = vanilla.call(this, ...defaultArgs);
                const file = defaultArgs[0];
                if (file?.extension === "md") {
                    self.updateDomTitle(file, c);
                }
                return c;
            });
            replacers.set(dom, replacer);
            this.replacers.set(dom, replacer);
        }
        return replacers;
    }

    private updateDomTitle(file: TFile, el: { containerEl: Element }, restore = false): void {
        const title = restore ? file.basename : this.resolver.resolve(file.path);
        const c = el.containerEl.find(".tree-item-inner");
        if (title && c.getText() !== title) {
            c.setText(title);
        }
    }
    private updateAllDomTitles(dom: SearchDOM, restore = false): void {
        for (const [file, el] of dom.resultDomLookup.entries()) {
            if (file?.extension === "md") {
                this.updateDomTitle(file, el, restore);
            }
        }
    }

    private updateDomesTitle(restore = false): void {
        for (const dom of Object.values(this.getSearchDomes())) {
            this.updateAllDomTitles(dom, restore);
        }
    }

    public async disable(): Promise<void> {
        this.getSearchDomes().forEach(e => this.replacers.get(e)?.disable())
        this.enabled = false;
        this.updateDomesTitle(true);
    }

    public async enable(): Promise<void> {
        this.enabled = true;
        const run = () => {
            for (const [d, r] of this.initReplacers()) {
                r.enable();
                this.updateAllDomTitles(d);
            }
        }
        run();

        this.refs.push(this.dispatcher.addListener({
            name: 'layout:change',
            cb: () => {
                console.log('lc')
                this.timer && clearTimeout(this.timer);
                this.timer = setTimeout(() => run(), 1000)
            }
        }))
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
