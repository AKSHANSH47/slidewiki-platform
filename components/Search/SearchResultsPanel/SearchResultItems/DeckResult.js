import React from 'react';
import classNames from 'classnames/bind';
import customDate from '../../../Deck/util/CustomDate';
import {Microservices} from '../../../../configs/microservices';
import {connectToStores} from 'fluxible-addons-react';

class DeckResult extends React.Component {
    render() {
        return (
            <div className="accordionItem ui segment">
                <div className="title">
                    <div className="ui two column grid container">
                        <div className="column">
                            <div className="content">
                                <h3 className="ui header">
                                    <a href='/deck/77-1'>
                                        <i className="large yellow folder open aligned icon" aria-label="deck"></i>
                                        Semantic Web Introduction
                                    </a>
                                </h3>
                                <div className="meta">Creator:&nbsp;
                                    <a href='/user/serafeim'>serafeim</a>
                                </div>
                                <div className="meta">Origin:&nbsp;
                                    <a href={`/deck/72-1`}>Semantic Web Origin Deck</a>&nbsp;by&nbsp;
                                    <a href={`/user/serafeim`}>serafeim</a>
                                </div>
                                <div className="meta">Last modified: 21st April 2017</div>
                                <div className="meta">License: CC0</div>
                                <div className="description">Description: This is a simple intro to semantic web technologies</div>
                            </div>
                        </div>
                        <div className="column">
                            <div className="ui hidden divider"></div>
                            <div className="meta">
                                <div className="ui large label" tabIndex="-1">
                                    <i className="ui comments outline icon"></i>English
                                </div>
                                <div className="ui large label" tabIndex="0">
                                    <i className="block layout icon" aria-label="Number of slides"></i>10
                                </div>
                                <div className="ui large label" tabIndex="0">
                                    <i className="theme icon" aria-label="Theme"></i>default
                                </div>
                                <button className="ui compact icon button">
                                  <i className="fork icon"></i>
                                  3
                                </button>
                                <div className="ui large label" tabIndex="0">
                                    <i className="thumbs up icon" aria-label="Number of likes"></i>5
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="content">
                    <div className="ui basic segment">
                        <h3>Forks</h3>
                        <div className="ui relaxed divided list">
                            <div className="item"  key="1">
                                <div className="content">
                                    <a href="/deck/1249" className="header">Semantic Web Introduction</a>
                                    <div className="description">Created on 28th September 2016 by <a href="/user/serafeim">serafeim</a>
                                    </div>
                                </div>
                            </div>
                            <div className="item"  key="2">
                                <div className="content">
                                    <a href="/deck/1249" className="header">Semantic Web Introduction</a>
                                    <div className="description">Created on 20th September 2016 by <a href="/user/abijames">abijames</a>
                                    </div>
                                </div>
                            </div>
                            <div className="item"  key="3">
                                <div className="content">
                                    <a href="/deck/1249" className="header">Semantic Web Introduction</a>
                                    <div className="description">Created on 20th September 2016 by <a href="/user/kadevgraaf">kadevgraaf</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

DeckResult.contextTypes = {
    executeAction: React.PropTypes.func.isRequired
};

export default DeckResult;
