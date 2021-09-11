# version 1.2.0
# docker pull doctorray/minecraft-ecsfargate-watchdog

FROM amazon/aws-cli

RUN yum install -y net-tools jq go && \
    yum clean all
RUN go get github.com/itzg/go-mc-status

COPY ./watchdog.sh .

ENTRYPOINT ["./watchdog.sh"]
