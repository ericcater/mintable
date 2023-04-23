import { FinicityConnect, ConnectEventHandlers, ConnectOptions, ConnectDoneEvent, ConnectCancelEvent, ConnectErrorEvent, ConnectRouteEvent } from '@finicity/connect-web-sdk';

export class ConnectComponent {
  
  connectEventHandlers: ConnectEventHandlers = {
    onDone: (event: ConnectDoneEvent) => { console.log(event); },
    onCancel: (event: ConnectCancelEvent) => { console.log(event); },
    onError: (event: ConnectErrorEvent) => { console.log(event); },
    onRoute: (event: ConnectRouteEvent) => { console.log(event); },
    onUser: (event: any) => { console.log(event); },
    onLoad: () => { console.log('loaded'); }
  };

  connectOptions: ConnectOptions = {
    popup: true,
    popupOptions: {
      width: 600,
      height: 600,
      top: window.top.outerHeight / 2 + window.top.screenY - (600 / 2),
      left: window.top.outerWidth / 2 + window.top.screenX - (600 / 2)
    }
  };

  constructor() {
    FinicityConnect.launch(
      'CONNECT_URL',
     this.connectEventHandlers,
     this.connectOptions);
  }
}