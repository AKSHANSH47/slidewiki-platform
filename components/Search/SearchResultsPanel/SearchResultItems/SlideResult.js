import React from 'react';
import classNames from 'classnames/bind';
import customDate from '../../../Deck/util/CustomDate';
import {Microservices} from '../../../../configs/microservices';

class SlideResult extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            mode: ''
        };
    }
    expand(_mode){
        this.setState({
            mode: _mode
        });
    }
    render() {
        let expandContent;
        if(this.state.mode === 'matches'){
            expandContent = <div className="ui basic segment" id="1247">
                <h3>Other matching slide revisions</h3>
                <div className="ui relaxed divided list">
                    <div className="item"  key="1">
                        <div className="content">
                            <a href="/deck/1249" className="header">So is it all about training?</a>
                            <div className="description">Created on 28th September 2016 by <a href="/user/kadevgraaf">kadevgraaf</a>
                            </div>
                        </div>
                    </div>
                    <div className="item"  key="2">
                        <div className="content">
                            <a href="/deck/1249" className="header">So is it all about training?</a>
                            <div className="description">Created on 20th September 2016 by <a href="/user/kadevgraaf">kadevgraaf</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>;
        } else {
            expandContent = <div className="ui basic segment" id="1247">
                <h3>Slide also used in</h3>
                <div className="ui relaxed divided list">
                    <div className="item" key="1">
                        <div className="content">
                            <a href="/deck/1249" className="header">New deck</a>
                            <div className="description">Created on 28th September 2016 by <a href=""> serafeim</a>
                            </div>
                        </div>
                    </div>
                    <div className="item" key="2">
                        <div className="content">
                            <a href="/deck/1249" className="header">Deck Test</a>
                            <div className="description">Created on 20th September 2016 by <a href=""> abijames</a>
                            </div>
                        </div>
                    </div>
                    <div className="item">
                        <div className="content" key="2">
                            <a href="/deck/1249" className="header">Got the tech</a>
                            <div className="description">Created on 20th September 2016 by <a href=""> kadevgraaf</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>;
        }
        return (
            <div className="accordionItem ui segment">
                <div className="title">
                    <div className="ui two column grid container">
                        <div className="column">
                            <div className="content">
                                <h3 className="ui header">
                                    <a href='/deck/33-1/slide/65-2'>
                                        <i className="large grey file text middle aligned icon" aria-label="slide"></i>
                                        So is it all about training?
                                    </a>
                                </h3>
                                <div className="meta">Creator:&nbsp;
                                    <a href='/user/kadevgraaf'>kadevgraaf</a>
                                </div>
                                <div className="meta">Last modified: 29th September 2016</div>
                                <div className="meta">License: CC0</div>
                                <div className="description">Description: Slide description goes here</div>
                                <div className="usage">in <a href=''>Deck Title</a> by user <a href='/user/kadevgraaf'>kadevgraaf</a></div>
                            </div>
                        </div>
                        <div className="column">
                            <div className="ui hidden divider"></div>
                            <div className="meta">
                                <div className="ui large label" tabIndex="-1">
                                    <i className="ui comments outline icon"></i>English
                                </div>
                                <button className="ui compact button" onClick={this.expand.bind(this, 'matches')}>
                                    all matches (2)
                                </button>
                                <button className="ui compact button" onClick={this.expand.bind(this, 'usage')}>
                                    other usage (3)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="content">
                    {expandContent}
                </div>
            </div>
        );
    }
}

export default SlideResult;
