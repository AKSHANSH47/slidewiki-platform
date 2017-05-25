import React from 'react';
import DeckResult from './SearchResultItems/DeckResult';
import SlideResult from './SearchResultItems/SlideResult';

class SearchResultsList extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    initAccordion(){
        let self = this;
        $('.ui.accordion').accordion({
            selector: {
                trigger: '.title .button'
            },
            onOpening: function(){

            }
        });
    }
    componentDidMount(){
        this.initAccordion();
    }
    componentDidUpdate(){
        this.initAccordion();
    }
    render() {
        // let list = this.props.items.slice(0,2).map((node, index) => {
        //     let resultItem;
        //     if(node.kind === 'Deck'){
        //         resultItem = <DeckResult key={index} data={node} />;
        //     } else {
        //         resultItem = <SlideResult key={index} data={node} />;
        //     }
        //     return resultItem;
        // });
        let list = [];
        list.push(<DeckResult key="1" />);
        list.push(<SlideResult key="2"/>);

        return (
            <div className="ui accordion fluid">
                {list}
            </div>
        );
    }
}

export default SearchResultsList;
